// q-code-target.mjs — which tree a `q code|sym|file` answers from: the cwd repo (default), a
// registered project (`--project`, `--repo <project>`), or another directory (`--dir`, `--repo <dir>`,
// an absolute `--path` outside the repo). A directory inside a git work tree is answered from that
// checkout's index (q-dir-target); any other is scanned on demand, bounded (q-scan-dir).
//
//   resolveTarget(flags, root, refresh) -> { error } | { root, refresh, scanned, prefix, path, dir }
//     scanned: the dirIndex result when a scan answers, else null
//     prefix:  absolute root to put on every answer path (foreign checkout answered from its index), else ''
//     path:    the --path filter, relative to the answering root
//     dir:     the scanned directory, else undefined
//   scansOnDemand(flags, root) -> true when the answer may read files off disk (the resident server must not)

import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { refreshIndex } from './code-index.mjs';
import { knownProject, projectRepo } from './q-project.mjs';
import { dirIndex } from './q-scan-dir.mjs';
import { indexedPlace } from './q-dir-target.mjs';

export const isAbsolutePath = (path) => isAbsolute(path) || /^[A-Za-z]:\//.test(path);

/** `--path D:/dev/repo/crates/x` names the same place as `--path crates/x` from inside the repo. */
export function repoRelative(root, path) {
  if (!isAbsolutePath(path)) return path;
  const rel = relative(root, path).replace(/\\/g, '/');
  return rel.startsWith('..') || isAbsolute(rel) ? path : rel;
}

const outsideIndex = (flags, root) => flags.dir === undefined && flags.path && isAbsolutePath(flags.path) && repoRelative(root, flags.path) === flags.path;

export function scansOnDemand(flags, root) {
  return flags.dir !== undefined || flags.repo !== undefined || outsideIndex(flags, root);
}

const projectTarget = (name, flags) => {
  const root = projectRepo(name);
  return { root, refresh: refreshIndex, scanned: null, prefix: '', path: flags.path && repoRelative(root, flags.path) };
};

export async function resolveTarget(flags, root, refresh) {
  let { project, dir } = flags;
  if (flags.repo !== undefined) {
    if (knownProject(flags.repo)) project = flags.repo;
    else if (existsSync(resolve(flags.repo))) dir = flags.repo;
    else return { error: `q --repo ${flags.repo}: neither a registered project nor an existing directory` };
  }
  if (project !== undefined) return projectTarget(project, flags);
  let path = flags.path;
  if (dir === undefined && outsideIndex(flags, root)) {
    if (!existsSync(path)) return { error: `q --path ${path}: outside the index and not found on disk` };
    dir = path;
    path = undefined;
  }
  if (dir === undefined) return { root, refresh, scanned: null, prefix: '', path: path && repoRelative(root, path) };
  const place = indexedPlace(dir);
  if (place) {
    const sub = [place.path, path && repoRelative(place.root, path)].filter(Boolean).join('/');
    return { root: place.root, refresh: refreshIndex, scanned: null, prefix: place.root, path: sub || undefined };
  }
  const scanned = dirIndex(dir);
  return { root: dir, refresh: async () => scanned, scanned, prefix: '', path: path && repoRelative(dir, path), dir };
}
