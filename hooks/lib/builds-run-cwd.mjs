// builds-run-cwd.mjs — the working directory of the command a `builds --run "<command>" --cwd <dir>` call runs (KIT-T1284). The
// quoted command resolves its relative paths against --cwd, so a gate that judges it must too.
//
//   runCwd(text) -> { flag, resolvable }   `flag` is the --cwd value as written ('' when none); `resolvable` is false when the
//     flag has no value or names a variable, a substitution, a glob, a tilde or a brace the gate cannot expand
//   rebased(flag, path) -> string          `path` as the quoted command's own path under --cwd: joined to `flag` and normalized
//     when relative, unchanged without a flag or when absolute

import { isAbsolute, posix } from 'node:path';
import { commandTokens } from './lead-command-walk.mjs';
import { dequoted, toPath } from './shell-segments.mjs';

const CWD_FLAG = '--cwd';
const UNRESOLVABLE = /[$`()*?~[\]{}<>|;&]/;

export function runCwd(text) {
  const tokens = commandTokens(text);
  const at = tokens.indexOf(CWD_FLAG);
  if (at < 0) return { flag: '', resolvable: true };
  const raw = tokens[at + 1];
  if (raw === undefined || raw.startsWith('--')) return { flag: '', resolvable: false };
  return { flag: dequoted(raw), resolvable: !UNRESOLVABLE.test(raw) && dequoted(raw) !== '' };
}

export function rebased(flag, path) {
  const text = String(toPath(path)).replace(/\\/g, '/');
  return !flag || isAbsolute(text) || /^[A-Za-z]:\//.test(text) ? text : posix.join(flag.replace(/\\/g, '/'), text);
}
