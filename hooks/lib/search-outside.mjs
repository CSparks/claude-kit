// search-outside.mjs — what the path operands of a search resolve to, for the retrieval gate (KIT-T1157). A search of
// a file outside every adopted repo (a session scratchpad test log) is no search of the source tree.
//
//   resolvedSegments(parts, shell) -> Map<segment, text>    each segment's text with the variables expanded that a bare
//     `NAME=value` fixes before it, unconditionally and in the same shell (shell-variables.mjs assignedValues, the strict
//     resolver: a conditional, prefix, later or subshell assignment leaves the variable unresolved and the search blocked)
//   targetsOutsideRepos(paths, root, cwd) -> boolean        at least one path, and every path either an absolute file path that
//     lands outside `root` and inside no adopted repo (lands-outside-repo.mjs), or an absolute existing directory that is
//     inside and above no registered project, data root or adopted repo and under no `.ai` (KIT-T1450)
//   unresolvedTargetNote(paths) -> string                   the block-text line naming a path that still holds a variable

import { statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { adopted, gitRoot, gitRootOfFile } from './paths.mjs';
import { landsOutsideRepo, realPath } from './lands-outside-repo.mjs';
import { readRegistry } from './registry.mjs';
import { toPath } from './shell-segments.mjs';
import { assignedValues, expandVariables } from './shell-variables.mjs';

const VARIABLE = /\$\{?[A-Za-z_]/;
const OUTSIDE = /^\.\.(?:[\\/]|$)/;

export function resolvedSegments(parts, shell) {
  const values = assignedValues(parts, shell);
  return new Map([...parts].map((seg) => [seg, expandVariables(seg.text, values.get(seg), shell)]));
}

const AI_SEGMENT = /(?:^|[\\/])\.ai(?:[\\/]|$)/;
const isDirectory = (path) => {
  try { return statSync(path).isDirectory(); } catch { return false; }
};
const apart = (a, b) => { const rel = relative(a, b); return OUTSIDE.test(rel) || isAbsolute(rel); };

// Every root a search must not wander into: each registered project, the central data root (its projects hold the .ai
// stores), the unbounded store, the session root and the repo of the working directory.
function protectedRoots(root, cwd) {
  const reg = readRegistry();
  const named = [...Object.values(reg.projects), reg.dataRoot, reg.unbounded, root, gitRoot(cwd)];
  return named.filter((r) => typeof r === 'string' && r.trim()).map((r) => realPath(r));
}

// An absolute directory that sits inside no protected root and contains none (a scratch folder in the user temp directory),
// inside no adopted repo and under no `.ai`: searching it is no search of source, so q has no better answer (KIT-T1450).
function directoryOutsideProjects(native, root, cwd) {
  const dir = realPath(resolve(cwd, native));
  if (!isDirectory(dir) || AI_SEGMENT.test(dir) || adopted(gitRootOfFile(join(dir, 'x')))) return false;
  return protectedRoots(root, cwd).every((p) => apart(p, dir) && apart(dir, p));
}

function outsideEveryRepo(path, root, cwd) {
  const native = toPath(path);
  if (!isAbsolute(native) || VARIABLE.test(native)) return false;
  if (isDirectory(resolve(cwd, native))) return directoryOutsideProjects(native, root, cwd);
  return landsOutsideRepo(native, root, cwd) && !adopted(gitRootOfFile(resolve(cwd, native)));
}

export const targetsOutsideRepos = (paths, root, cwd) => paths.length > 0 && paths.every((p) => outsideEveryRepo(p, root, cwd));

export function unresolvedTargetNote(paths) {
  const variable = paths.find((p) => VARIABLE.test(p));
  return variable
    ? `\nThe search target ${variable} is a shell variable this gate could not resolve. Assign it as one literal at the start of the command, before any && or || (S=/path/to/log.txt; rg <pattern> $S), or write the path out; a file outside every adopted repo then passes.\n`
    : '';
}
