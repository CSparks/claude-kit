// config.mjs — the broker's per-project configuration, read from `.ai/config.yml`'s
// `broker:` section with a dependency-free YAML subset parser (the kit ships no yaml dep).
//
// USE: `readBrokerConfig(root)` → a normalized config; `brokerPaths(cfg)` → the control
// dirs; `repoByName(cfg, name)` → the repo entry a job names. The parser handles the subset
// the broker config needs: nested maps, block/scalar lists, and inline flow maps/lists.
//
// A `broker:` section shape:
//   broker:
//     target_dir: <shared CARGO_TARGET_DIR>        # default <root>/target
//     parallelism: { jobs: auto }                  # default auto (jobs.mjs: the cores RAM can feed); a number pins it
//     verify_default: [ "cargo test --no-fail-fast" ]  # commands a job may omit
//     poll_ms: 2000                                # daemon queue poll interval
//     coalesce_ms: 2000                            # a drain waits until the queue has been quiet this long (0 starts at once), so
//                                                    # back-to-back submits form one train; capped at 5x this from the oldest job
//     stall_kill_s: 600                            # wait/submit kill a daemon silent this long (default 600; 0 never kills)
//     writer_cap: 3                                # most patch-worker agents in flight per checkout (dispatch-worker.mjs)
//     command_timeout_multiple: 4                  # a job command is killed past this multiple of its longest passing run (command-limit.mjs)
//     command_timeout_floor_s: 600                 # ... but never before this many seconds; 0 turns the timeout off
//     untracked_blocks: ["crates/**/*.rs"]        # untracked paths that pause the queue; absent, derived from
//                                                    # the checkout's tracked crates and workspace members (blocks.mjs),
//                                                    # falling back to ["**/*.rs", "**/Cargo.toml"] without a Cargo.toml
//     dirty_blocks: ["**/*.rs", "**/Cargo.toml"]  # tracked modifications that pause
//                                                    # the queue (plus any path the job's patch
//                                                    # touches); other dirty tracked files are left alone.
//                                                    # Cargo.lock never pauses: patch.mjs journals it.
//     repos:
//       - { name: stiletto,   path: ., main: main, remote: origin }
//       - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: .,
//           pre_push: true,                       # the daemon runs the repo's pre-push gate before git push (prepush.mjs)
//           gate_prebuild: "cd rust && cargo t --no-run",  # a landing's check also builds what that gate runs (prebuild.mjs)
//           auto_pin: true,                       # on a consumer's submodule entry: every submodule landing queues a pin job here (autopin.mjs)
//           suite: "npm run check:all" }          # this lane's idle full run, filing a regression on red (suite.mjs); a scalar, a flow map cannot hold a list

import { readFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { resolveJobs } from './jobs.mjs';
import { pipelineConfig } from './pipeline-config.mjs';
import { PAUSE_GLOBS } from './build-globs.mjs';

const MS_PER_S = 1000;
const DEFAULT_TIMEOUT_MULTIPLE = 4;
const DEFAULT_TIMEOUT_FLOOR_S = 600;
const DEFAULT_POLL_MS = 2000;
const DEFAULT_COALESCE_MS = 2000;
const DEFAULT_VERIFY = ['cargo test --no-fail-fast'];
const DEFAULT_UNTRACKED_BLOCKS = PAUSE_GLOBS;
const DEFAULT_DIRTY_BLOCKS = DEFAULT_UNTRACKED_BLOCKS;

export function readBrokerConfig(root, aiDir = join(root, '.ai')) {
  let text = '';
  try {
    text = readFileSync(join(aiDir, 'config.yml'), 'utf8');
  } catch {
    text = '';
  }
  const doc = parseYaml(text) || {};
  return normalizeBroker(root, doc.broker || {});
}

// Split from the file reader so a test can normalize a literal object without touching disk.
export function normalizeBroker(root, broker) {
  const targetRaw = broker.target_dir || join(root, 'target');
  const targetDir = isAbsolute(targetRaw) ? targetRaw : resolve(root, targetRaw);
  const jobs = resolveJobs(broker.parallelism && broker.parallelism.jobs);
  const threads = Number(broker.parallelism && broker.parallelism.test_threads);
  const testThreads = Number.isInteger(threads) && threads >= 1 ? threads : null;
  const verifyDefault = Array.isArray(broker.verify_default) && broker.verify_default.length
    ? broker.verify_default.map(String)
    : DEFAULT_VERIFY.slice();
  const repos = (Array.isArray(broker.repos) ? broker.repos : []).map(normalizeRepo);
  return {
    root,
    targetDir,
    jobs,
    testThreads,
    verifyDefault,
    pollMs: num(broker.poll_ms, DEFAULT_POLL_MS),
    coalesceMs: Math.max(0, num(broker.coalesce_ms, DEFAULT_COALESCE_MS)),
    stallKillS: broker.stall_kill_s == null || broker.stall_kill_s === '' ? null : num(broker.stall_kill_s, null),
    writerCap: Math.max(1, Math.floor(num(broker.writer_cap, 3))),
    commandTimeout: { multiple: Math.max(1, num(broker.command_timeout_multiple, DEFAULT_TIMEOUT_MULTIPLE)), floorMs: Math.max(0, num(broker.command_timeout_floor_s, DEFAULT_TIMEOUT_FLOOR_S)) * MS_PER_S },
    untrackedBlocks: Array.isArray(broker.untracked_blocks) ? broker.untracked_blocks.map(String) : DEFAULT_UNTRACKED_BLOCKS.slice(),
    untrackedDerived: !Array.isArray(broker.untracked_blocks),
    dirtyBlocks: Array.isArray(broker.dirty_blocks) ? broker.dirty_blocks.map(String) : DEFAULT_DIRTY_BLOCKS.slice(),
    repos,
    lane: null,
    ...pipelineConfig(broker, verifyDefault, process.env, root),
  };
}

function normalizeRepo(r) {
  const o = r && typeof r === 'object' ? r : {};
  return {
    name: String(o.name || ''),
    path: o.path == null ? '.' : String(o.path),
    main: String(o.main || 'main'),
    remote: String(o.remote || 'origin'),
    submodule: Boolean(o.submodule),
    pinIn: o.pin_in == null ? '.' : String(o.pin_in),
    prePush: Boolean(o.pre_push),
    autoPin: Boolean(o.auto_pin),
    gatePrebuild: o.gate_prebuild ? String(o.gate_prebuild) : null,
    suite: o.suite == null ? [] : [].concat(o.suite).map(String).filter(Boolean),
  };
}

export function repoByName(cfg, name) {
  return cfg.repos.find((r) => r.name === name) || null;
}

// One queue and one daemon per repo (KIT-D096). The root lane (`lane` null) serves every repo that
// is not a submodule; each `submodule: true` repo is its own lane, with its own queue dir, lock,
// results and daemon, so neither waits on the other's jobs.
export const laneOfRepo = (cfg, repoName) => {
  const repo = repoByName(cfg, repoName);
  return repo && repo.submodule ? repo.name : null;
};
export const withLane = (cfg, lane) => ({ ...cfg, lane: lane || null });
/** [null, ...submodule repo names]: every lane of this checkout. */
export const lanesOf = (cfg) => [null, ...cfg.repos.filter((r) => r.submodule).map((r) => r.name)];
/** The per-lane configs of a checkout, root lane first. */
export const laneConfigs = (cfg) => lanesOf(cfg).map((l) => withLane(cfg, l));

// The broker's control directories live under `<targetDir>/broker` so the build cache and the
// broker's own state share one gitignored home (target/ is gitignored, no store hooks fire).
export function brokerPaths(cfg) {
  const home = cfg.lane ? join(cfg.targetDir, 'broker', 'lanes', cfg.lane) : join(cfg.targetDir, 'broker');
  return {
    home,
    queue: join(home, 'queue'),
    results: join(home, 'results'),
    logs: join(home, 'logs'),
    lock: join(home, 'broker.lock'),
    beat: join(home, 'broker.beat'),
    spawning: join(home, 'broker.spawning'),
  };
}

function num(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

// --- YAML subset parser --------------------------------------------------------------------
// Recursive-descent over indentation. Supports: nested maps, lists of scalars, lists of inline
// flow maps ({a: b, c: d}), lists of block maps (- key: v / next lines), and inline flow lists.
// Not a general YAML engine — deliberately the subset the broker config uses.
export function parseYaml(text) {
  const lines = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const noComment = stripComment(raw);
    if (!noComment.trim()) continue;
    lines.push({ indent: noComment.match(/^ */)[0].length, content: noComment.trim() });
  }
  let i = 0;

  function parseBlock(minIndent) {
    if (i >= lines.length || lines[i].indent < minIndent) return null;
    const base = lines[i].indent;
    return lines[i].content.startsWith('- ') ? parseList(base) : parseMap(base);
  }
  function parseMap(indent) {
    const obj = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].content.startsWith('- ')) {
      const m = lines[i].content.match(/^([^:]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      const key = m[1].trim();
      const rest = m[2];
      if (rest === '') {
        i++;
        obj[key] = i < lines.length && lines[i].indent > indent ? parseBlock(indent + 1) : null;
      } else {
        obj[key] = parseScalarOrFlow(rest);
        i++;
      }
    }
    return obj;
  }
  function parseList(indent) {
    const arr = [];
    while (i < lines.length && lines[i].indent === indent && lines[i].content.startsWith('- ')) {
      const after = lines[i].content.slice(2).trim();
      if (after === '') {
        i++;
        arr.push(i < lines.length && lines[i].indent > indent ? parseBlock(indent + 1) : null);
      } else if (after.startsWith('{') || after.startsWith('[')) {
        arr.push(parseScalarOrFlow(after));
        i++;
      } else if (/^[^:{[]+:\s*/.test(after)) {
        arr.push(parseBlockMapItem(indent, after));
      } else {
        arr.push(parseScalar(after));
        i++;
      }
    }
    return arr;
  }
  // A `- key: value` item: the dash line seeds the map; deeper lines (indent > dash) continue it.
  function parseBlockMapItem(dashIndent, firstLine) {
    const obj = {};
    const seed = firstLine.match(/^([^:]+):\s*(.*)$/);
    if (seed) obj[seed[1].trim()] = seed[2] === '' ? null : parseScalarOrFlow(seed[2]);
    i++;
    while (i < lines.length && lines[i].indent > dashIndent && !lines[i].content.startsWith('- ')) {
      const m = lines[i].content.match(/^([^:]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      obj[m[1].trim()] = m[2] === '' ? null : parseScalarOrFlow(m[2]);
      i++;
    }
    return obj;
  }
  return i < lines.length || lines.length ? parseMap(lines.length ? lines[0].indent : 0) : {};
}

function stripComment(line) {
  let out = '';
  let qs = 0;
  let qd = 0;
  for (let k = 0; k < line.length; k++) {
    const c = line[k];
    if (c === "'" && !qd) qs ^= 1;
    else if (c === '"' && !qs) qd ^= 1;
    else if (c === '#' && !qs && !qd && (k === 0 || /\s/.test(line[k - 1]))) break;
    out += c;
  }
  return out;
}

function parseScalarOrFlow(s) {
  const t = s.trim();
  if (t.startsWith('{') && t.endsWith('}')) return parseFlowMap(t);
  if (t.startsWith('[') && t.endsWith(']')) return parseFlowList(t);
  return parseScalar(t);
}
function parseFlowMap(t) {
  const obj = {};
  for (const part of splitTop(t.slice(1, -1))) {
    const m = part.match(/^([^:]+):\s*(.*)$/);
    if (m) obj[m[1].trim()] = parseScalar(m[2].trim());
  }
  return obj;
}
function parseFlowList(t) {
  return splitTop(t.slice(1, -1)).map((p) => parseScalar(p.trim())).filter((v) => v !== null || true);
}
// Split on top-level commas (our flow collections do not nest), honoring quotes.
function splitTop(s) {
  const out = [];
  let cur = '';
  let qs = 0;
  let qd = 0;
  for (const c of s) {
    if (c === "'" && !qd) qs ^= 1;
    else if (c === '"' && !qs) qd ^= 1;
    if (c === ',' && !qs && !qd) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function parseScalar(v) {
  let t = String(v).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  if (t === '' || t === '~' || t === 'null') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
  return t;
}
