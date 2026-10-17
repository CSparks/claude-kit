// broker-owned-tree — a dispatch check for dispatch-guard (KIT-T276). While a broker daemon
// holds a checkout's lock, the daemon is that tree's only writer: a writer-capable agent
// dispatched into it is blocked and pointed at the read-only `patch-worker`. Read-only types
// pass. The only escape is the maintainer's quoted words, as for shared-tree-dispatch.

import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import { hasTrackedCargo } from '../scripts/broker/cargo-scope.mjs';
import { isBuildInput } from '../scripts/broker/build-globs.mjs';
import { includeTargets } from '../scripts/broker/build-inputs.mjs';

export const BROKER_OWNED_CHECK = 'broker-owned-tree';

// `broker.target_dir` from the project's config (relative paths resolve against the tree).
function targetDir(tree) {
  try {
    const lines = readFileSync(join(tree, '.ai', 'config.yml'), 'utf8').split(/\r?\n/);
    const at = lines.findIndex((l) => /^broker:\s*$/.test(l));
    for (let i = at + 1; at >= 0 && i < lines.length && /^(\s|$)/.test(lines[i]); i++) {
      const m = /^\s+target_dir:\s*["']?([^"'#\s]+)/.exec(lines[i]);
      if (m) return isAbsolute(m[1]) ? m[1] : resolve(tree, m[1]);
    }
  } catch { /* default below */ }
  return join(tree, 'target');
}

// Only a Cargo workspace whose `.ai/config.yml` declares broker repos is brokered (KIT-D096, KIT-D097);
// any other repo (claude-kit, a Node repo) is never broker-owned, whatever a stray lock file says.
function brokersRepo(tree) {
  try {
    const lines = readFileSync(join(tree, '.ai', 'config.yml'), 'utf8').split(/\r?\n/);
    const at = lines.findIndex((l) => /^broker:\s*$/.test(l));
    for (let i = at + 1; at >= 0 && i < lines.length && /^(\s|$)/.test(lines[i]); i++) if (/^\s+repos:/.test(lines[i])) return hasTrackedCargo(tree);
  } catch { /* no config: not brokered */ }
  return false;
}

/** The live daemon holding `tree`'s broker lock as { pid, host }, or null. */
export function liveBroker(tree) {
  try {
    if (!brokersRepo(tree)) return null;
    const file = join(targetDir(tree), 'broker', 'broker.lock');
    if (!existsSync(file)) return null;
    const held = JSON.parse(readFileSync(file, 'utf8'));
    if (held.host !== hostname()) return held; // another host's lock: fail safe, treat as live
    process.kill(held.pid, 0);
    return held;
  } catch (e) {
    return e && e.code === 'EPERM' ? { pid: 0, host: hostname() } : null;
  }
}

const PATHS_TOKEN = /\[paths:\s*([^\]]+)\]/i;

// The repo-relative paths a brief declares with `[paths: a, b]`, or null when it declares none.
export function declaredPaths(prompt, tree) {
  const m = PATHS_TOKEN.exec(String(prompt || ''));
  if (!m) return null;
  const root = String(tree).split(String.fromCharCode(92)).join('/').replace(/\/$/, '');
  const paths = m[1].split(/[\s,]+/).filter(Boolean).map((p) => p.split(String.fromCharCode(92)).join('/')).map((p) => (p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p));
  return paths.length ? paths : null;
}

// True when the brief declares paths and none is a build input (KIT-D097): the daemon owns only files a compile reads.
export function writesNoBuildInput(prompt, tree) {
  const paths = declaredPaths(prompt, tree);
  if (!paths) return false;
  const included = new Set(includeTargets(tree));
  return paths.every((p) => !isBuildInput(p) && !included.has(p));
}

export function brokerOwnedMessage({ agent, tree, held, footer }) {
  return [
    `BLOCKED: a broker daemon owns this working tree (pid ${held.pid}, ${join(tree, 'target', 'broker')}).`,
    `  agent: ${agent}   tree: ${tree}`,
    '',
    'The broker daemon is the only writer here: it applies patches, builds, tests and lands them.',
    'A second writer would race it for HEAD, the index and the files.',
    '',
    'A writer whose brief touches no build input (.rs, Cargo.toml, Cargo.lock, .cargo/config*, rust-toolchain*,',
    'include!() targets) is admitted: declare its paths in the prompt as [paths: docs/x.md, tools/y.mjs].',
    '',
    'Fix: dispatch the read-only `claude-kit:patch-worker` (it submits patches to the daemon and',
    'waits for results; any number run in parallel; it may write envelope files under the session',
    'scratchpad or temp dir, never in this tree), or stop the daemon first. Only on the',
    "maintainer's words: include [maintainer-asked-parallel: <his words>] in the prompt.",
    '',
    footer,
  ].join('\n');
}
