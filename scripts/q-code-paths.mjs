// q-code-paths.mjs — several `--path` values for `q code|sym|file` (KIT-T975). One `--path` stays the
// single `flags.path` the index narrows by; a repeat turns the list into `flags.anyPaths`, a keep-only filter
// (the path test lives with the other exclusions in code-index-query.mjs).
//
//   addPath(flags, value, next)  records one `--path <value>`; `next` is the argv token after it
//   strayPathRows(flags, root)   the answer rows explaining `--path a b`: `b` became search text although it names a path under root

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function addPath(flags, value, next) {
  const paths = (flags.paths ??= []);
  paths.push(value);
  flags.pathNext = next !== undefined && !String(next).startsWith('-') ? String(next) : null;
  if (paths.length === 1) { flags.path = value; return; }
  flags.path = undefined;
  flags.anyPaths = paths;
}

const GLOB = /[*?]/;
const MAX_SUGGESTIONS = 3;

// The indexed directories and files that end in `path`: `crates/x` typed from inside `sub/` is `sub/crates/x` from the root.
function prefixesEndingIn(rels, path) {
  const found = new Set();
  for (const rel of rels) {
    const dir = rel.indexOf(`/${path}/`);
    if (dir >= 0) found.add(rel.slice(0, dir + 1 + path.length));
    else if (rel.endsWith(`/${path}`)) found.add(rel);
  }
  return [...found].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/**
 * The answer rows for an empty search whose `--path` names no indexed file: the root q resolved (`--path` is relative to it from
 * any cwd) and the repo-relative paths ending in the same name. `refresh(root)` yields the index files; nothing for a glob.
 */
export async function pathHintRows(flags, root, refresh) {
  const wanted = (flags.anyPaths || (flags.path ? [flags.path] : [])).map((p) => p.replace(/\/+$/, '')).filter((p) => p && !GLOB.test(p));
  if (!wanted.length) return [];
  const idx = await refresh(root);
  idx.handle?.close();
  const rels = idx.files.map((f) => f.rel);
  return wanted.filter((p) => !rels.some((rel) => rel === p || rel.startsWith(`${p}/`))).map((p) => {
    const near = prefixesEndingIn(rels, p).slice(0, MAX_SUGGESTIONS);
    const mean = near.length ? ` did you mean ${near.map((n) => `--path ${n}`).join(' or ')}?` : '';
    return { loc: '', text: `q: --path ${p} matches no indexed file under ${root.replace(/\\/g, '/')} (--path is relative to the repo root, not the cwd).${mean}` };
  });
}

export function strayPathRows(flags, root) {
  const word = flags.pathNext;
  if (!word || !existsSync(resolve(root, word))) return [];
  return [{ loc: '', text: `q: '${word}' follows --path ${flags.paths.at(-1)} and was searched for as text; it also names a path here. To search several paths repeat the flag: --path ${flags.paths.at(-1)} --path ${word}` }];
}
