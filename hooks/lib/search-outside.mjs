// search-outside.mjs — what the path operands of a search resolve to, for the retrieval gate (KIT-T1157). A search of
// a file outside every adopted repo (a session scratchpad test log) is no search of the source tree.
//
//   resolvedSegments(parts, shell) -> Map<segment, text>    each segment's text with the variables a bare `NAME=value`
//     earlier in the command fixes expanded (shell-variables.mjs precedingValues: a read, never a write, is judged)
//   targetsOutsideRepos(paths, root, cwd) -> boolean        at least one path, and every path an absolute file path that
//     lands outside `root` and inside no adopted repo (lands-outside-repo.mjs; a directory is never proof)
//   unresolvedTargetNote(paths) -> string                   the block-text line naming a path that still holds a variable

import { isAbsolute, resolve } from 'node:path';
import { adopted, gitRootOfFile } from './paths.mjs';
import { landsOutsideRepo } from './lands-outside-repo.mjs';
import { toPath } from './shell-segments.mjs';
import { expandVariables, precedingValues } from './shell-variables.mjs';

const VARIABLE = /\$\{?[A-Za-z_]/;

export function resolvedSegments(parts, shell) {
  const values = precedingValues(parts, shell);
  return new Map([...parts].map((seg) => [seg, expandVariables(seg.text, values.get(seg), shell)]));
}

function outsideEveryRepo(path, root, cwd) {
  const native = toPath(path);
  if (!isAbsolute(native) || VARIABLE.test(native)) return false;
  return landsOutsideRepo(native, root, cwd) && !adopted(gitRootOfFile(resolve(cwd, native)));
}

export const targetsOutsideRepos = (paths, root, cwd) => paths.length > 0 && paths.every((p) => outsideEveryRepo(p, root, cwd));

export function unresolvedTargetNote(paths) {
  const variable = paths.find((p) => VARIABLE.test(p));
  return variable
    ? `\nThe search target ${variable} is a shell variable this gate could not resolve. Assign it as one literal earlier in the same command (S=/path/to/log.txt; rg <pattern> $S) or write the path out; a file outside every adopted repo then passes.\n`
    : '';
}
