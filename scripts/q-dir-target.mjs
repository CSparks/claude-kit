// q-dir-target.mjs — where a `q code --dir <path>` (or an absolute `--path` outside the repo) is
// answered from. A path inside a git work tree and not ignored is answered from that checkout's
// code index (cached, incremental, gitignore-aware), so a sibling repo costs what a q inside it
// costs; anything else (logs, build output, a plain directory) is scanned on demand (q-scan-dir).
//
//   indexedPlace(dir) -> { root, path } | null   root: the work-tree top; path: dir relative to it ('' = whole tree)

import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const GIT_TIMEOUT_MS = 10_000;

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: GIT_TIMEOUT_MS, windowsHide: true });
  return r.error ? { status: null, out: '' } : { status: r.status, out: String(r.stdout || '').trim() };
}

export function indexedPlace(dir) {
  const abs = resolve(dir);
  let st;
  try { st = statSync(abs); } catch { return null; }
  const cwd = st.isDirectory() ? abs : dirname(abs);
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0 || !top.out) return null;
  if (git(cwd, ['check-ignore', '-q', '--', abs]).status === 0) return null;
  const root = resolve(top.out);
  const path = relative(root, abs).replace(/\\/g, '/');
  return path.startsWith('..') ? null : { root: root.replace(/\\/g, '/'), path };
}
