// redirect-writes.mjs — the files a shell command's own `>` / `>>` redirects write (KIT-T1479). A redirect names its
// file, so the file is the caller's own work wherever it lands: in the repo the call ran in or another one, and in the same
// command that goes on to commit it, before any hook could see the file.
//
//   redirectedFiles(command, { start, shell, bases }) -> absolute paths the command redirects into. A relative target is
//     resolved against the directory after the command's `cd` segments and against each of `bases`. A target no path can
//     name (a variable, a substitution, a device, a descriptor) is dropped.
//   redirectedRepoPaths(command, { root, start, shell, bases }) -> the repo-relative paths of `root` among them.

import { isAbsolute, resolve } from 'node:path';
import { redirectTargets } from './shell-write-scan.mjs';
import { commandCwd } from './shell-cwd.mjs';
import { toPath } from './shell-segments.mjs';
import { gitRootOfFile } from './paths.mjs';
import { repoRelative } from '../turn-writes.mjs';

const UNRESOLVABLE = /[$`*?]|^&|^\/dev\/|^nul$/i;

export function redirectedFiles(command, { start = process.cwd(), shell = '', bases = [] } = {}) {
  const text = String(command || '');
  const targets = redirectTargets(text, true, shell === 'bash').filter((t) => t && !UNRESOLVABLE.test(t)).map(toPath);
  const dirs = [...new Set([commandCwd(text, start, { shell }), ...bases])];
  return [...new Set(targets.flatMap((t) => (isAbsolute(t) ? [t] : dirs.map((dir) => resolve(dir, t)))))];
}

export function redirectedRepoPaths(command, { root, ...options }) {
  return redirectedFiles(command, options).filter((file) => gitRootOfFile(file) === root).map((file) => repoRelative(root, file)).filter(Boolean);
}
