// runtime-pin.mjs — a long-lived kit process marks the runtime copy it was loaded from as in use
// (KIT-T486), so `publish:runtime`'s prune never deletes the files under a running broker or
// q-server. The mark is `<runtime>/<sha>/.in-use/<pid>`, removed when the process exits; a mark
// whose pid is dead does not hold the copy.
//
// `pinRuntime()` — call once at daemon start; a no-op when the kit runs from a repo checkout.
// `liveUsers(dir)` → the live pids that pinned `dir` (prune skips a copy with any).

import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const SHA_DIR = /^[0-9a-f]{7,40}$/;
const MARKS = '.in-use';

const kitRoot = () => dirname(realpathSync(import.meta.dirname));

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

export function pinRuntime(root = kitRoot(), pid = process.pid) {
  if (!SHA_DIR.test(basename(root))) return null;
  const mark = join(root, MARKS, String(pid));
  mkdirSync(dirname(mark), { recursive: true });
  writeFileSync(mark, new Date().toISOString());
  process.once('exit', () => rmSync(mark, { force: true }));
  return mark;
}

export function liveUsers(dir) {
  const marks = join(dir, MARKS);
  if (!existsSync(marks)) return [];
  return readdirSync(marks).map(Number).filter((pid) => Number.isInteger(pid) && pid > 0 && alive(pid));
}

/** The runtime sha this process runs from, or 'repo' when it runs from a checkout. */
export function runtimeTag() {
  const name = basename(kitRoot());
  return SHA_DIR.test(name) ? name : 'repo';
}
