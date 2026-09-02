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
//     parallelism: { jobs: 3 }                     # default 3
//     verify_default: [ "cargo test --no-fail-fast" ]  # commands a job may omit
//     poll_ms: 2000                                # daemon queue poll interval
//     repos:
//       - { name: stiletto,   path: ., main: main, remote: origin }
//       - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }

import { readFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';

const DEFAULT_JOBS = 3;
const DEFAULT_POLL_MS = 2000;
const DEFAULT_VERIFY = ['cargo test --no-fail-fast'];

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
  const jobs = num(broker.parallelism && broker.parallelism.jobs, DEFAULT_JOBS);
  const verifyDefault = Array.isArray(broker.verify_default) && broker.verify_default.length
    ? broker.verify_default.map(String)
    : DEFAULT_VERIFY.slice();
  const repos = (Array.isArray(broker.repos) ? broker.repos : []).map(normalizeRepo);
  return {
    root,
    targetDir,
    jobs,
    verifyDefault,
    pollMs: num(broker.poll_ms, DEFAULT_POLL_MS),
    repos,
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
  };
}

export function repoByName(cfg, name) {
  return cfg.repos.find((r) => r.name === name) || null;
}

// The broker's control directories live under `<targetDir>/broker` so the build cache and the
// broker's own state share one gitignored home (target/ is gitignored, no store hooks fire).
export function brokerPaths(cfg) {
  const home = join(cfg.targetDir, 'broker');
  return {
    home,
    queue: join(home, 'queue'),
    results: join(home, 'results'),
    logs: join(home, 'logs'),
    lock: join(home, 'broker.lock'),
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
