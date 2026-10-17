// broker-owned-tree — a dispatch check for dispatch-guard (KIT-T276). While a broker daemon
// holds a lane's lock, the daemon is that lane's only writer: a writer-capable agent dispatched
// to write that lane's build inputs is blocked and pointed at the read-only `patch-worker`.
// A lane is the root checkout or one submodule repo (KIT-D096): a live rapid-game lane blocks
// rapid-game build files only, and a live root lane blocks the rest, never each other. Read-only
// types pass. The only escape is the maintainer's quoted words, as for shared-tree-dispatch.

import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';

import { brokerPaths, laneConfigs, withLane, readBrokerConfig } from '../scripts/broker/config.mjs';
import { hasTrackedCargo } from '../scripts/broker/cargo-scope.mjs';
import { isBuildInput } from '../scripts/broker/build-globs.mjs';
import { includeTargets } from '../scripts/broker/build-inputs.mjs';

export const BROKER_OWNED_CHECK = 'broker-owned-tree';

const slash = (p) => String(p).split(String.fromCharCode(92)).join('/');

// Only a Cargo workspace whose `.ai/config.yml` declares broker repos is brokered (KIT-D096, KIT-D097);
// any other repo (claude-kit, a Node repo) is never broker-owned, whatever a stray lock file says.
function brokerConfig(tree) {
  try {
    const cfg = readBrokerConfig(tree);
    return cfg.repos.length && hasTrackedCargo(tree) ? cfg : null;
  } catch { return null; }
}

// The daemon holding `laneCfg`'s lock as { pid, host }, or null.
function liveLock(laneCfg) {
  try {
    const file = brokerPaths(laneCfg).lock;
    if (!existsSync(file)) return null;
    const held = JSON.parse(readFileSync(file, 'utf8'));
    if (held.host !== hostname()) return held; // another host's lock: fail safe, treat as live
    process.kill(held.pid, 0);
    return held;
  } catch (e) {
    return e && e.code === 'EPERM' ? { pid: 0, host: hostname() } : null;
  }
}

/** The live daemon holding `tree`'s root-lane lock as { pid, host }, or null. */
export function liveBroker(tree) {
  const cfg = brokerConfig(tree);
  return cfg ? liveLock(withLane(cfg, null)) : null;
}

const PATHS_TOKEN = /\[paths:\s*([^\]]+)\]/i;

// The repo-relative paths a brief declares with `[paths: a, b]`, or null when it declares none.
export function declaredPaths(prompt, tree) {
  const m = PATHS_TOKEN.exec(String(prompt || ''));
  if (!m) return null;
  const root = slash(tree).replace(/\/$/, '');
  const paths = m[1].split(/[\s,]+/).filter(Boolean).map(slash).map((p) => (p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p));
  return paths.length ? paths : null;
}

// The lane (a submodule repo's name, or null for the root) and the path inside that repo.
function laneOfPath(cfg, rel) {
  const sub = cfg.repos
    .filter((r) => r.submodule && (rel === slash(r.path) || rel.startsWith(`${slash(r.path).replace(/\/$/, '')}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return sub ? { lane: sub.name, base: join(cfg.root, sub.path), inside: rel.slice(slash(sub.path).replace(/\/$/, '').length + 1) } : { lane: null, base: cfg.root, inside: rel };
}

/**
 * The live lane that blocks a writer dispatched into `tree`, as { lane, held, home }, or null (KIT-D097).
 * A brief declaring `[paths: …]` is blocked only by the lane owning a build input among them; a brief
 * declaring none is blocked by any live lane, the root lane first.
 */
export function blockingLane(prompt, tree) {
  const cfg = brokerConfig(tree);
  if (!cfg) return null;
  const found = (laneCfg) => { const held = liveLock(laneCfg); return held ? { lane: laneCfg.lane, held, home: brokerPaths(laneCfg).home } : null; };
  const paths = declaredPaths(prompt, tree);
  if (!paths) return laneConfigs(cfg).map(found).find(Boolean) || null;
  const included = new Map();
  for (const rel of paths) {
    const { lane, base, inside } = laneOfPath(cfg, rel);
    if (!included.has(base)) included.set(base, new Set(includeTargets(base)));
    if (!isBuildInput(inside) && !included.get(base).has(inside)) continue;
    const hit = found(withLane(cfg, lane));
    if (hit) return hit;
  }
  return null;
}

export function brokerOwnedMessage({ agent, tree, held, lane = null, home, footer }) {
  return [
    `BLOCKED: a broker daemon owns this working tree (pid ${held.pid}, ${lane ? `lane ${lane}` : 'root lane'}, ${home || join(tree, 'target', 'broker')}).`,
    `  agent: ${agent}   tree: ${tree}`,
    '',
    `The ${lane || 'root'} lane's daemon is the only writer of its build files: it applies patches, builds, tests and lands them.`,
    'A second writer would race it for HEAD, the index and the files.',
    '',
    'A writer whose brief touches no build input of a live lane (.rs, Cargo.toml, Cargo.lock, .cargo/config*,',
    'rust-toolchain*, include!() targets) is admitted: declare its paths in the prompt as',
    '[paths: docs/x.md, rapid-game/crates/y.rs]. Another lane, or another checkout, never blocks it.',
    '',
    'Fix: dispatch the read-only `claude-kit:patch-worker` (it submits patches to the daemon and',
    'waits for results; any number run in parallel; it may write envelope files under the session',
    'scratchpad or temp dir, never in this tree), or stop the daemon first. Only on the',
    "maintainer's words: include [maintainer-asked-parallel: <his words>] in the prompt.",
    '',
    footer,
  ].join('\n');
}
