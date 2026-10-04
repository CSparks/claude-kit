// broker-owned-tree — a dispatch check for dispatch-guard (KIT-T276). While a broker daemon
// holds a checkout's lock, the daemon is that tree's only writer: a writer-capable agent
// dispatched into it is blocked and pointed at the read-only `patch-worker`. Read-only types
// pass. The only escape is the maintainer's quoted words, as for shared-tree-dispatch.

import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

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

/** The live daemon holding `tree`'s broker lock as { pid, host }, or null. */
export function liveBroker(tree) {
  try {
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

export function brokerOwnedMessage({ agent, tree, held, footer }) {
  return [
    `BLOCKED: a broker daemon owns this working tree (pid ${held.pid}, ${join(tree, 'target', 'broker')}).`,
    `  agent: ${agent}   tree: ${tree}`,
    '',
    'The broker daemon is the only writer here: it applies patches, builds, tests and lands them.',
    'A second writer would race it for HEAD, the index and the files.',
    '',
    'Fix: dispatch the read-only `claude-kit:patch-worker` (it submits patches to the daemon and',
    'waits for results; any number run in parallel; it may write envelope files under the session',
    'scratchpad or temp dir, never in this tree), or stop the daemon first. Only on the',
    "maintainer's words: include [maintainer-asked-parallel: <his words>] in the prompt.",
    '',
    footer,
  ].join('\n');
}
