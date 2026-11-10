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

export function strayPathRows(flags, root) {
  const word = flags.pathNext;
  if (!word || !existsSync(resolve(root, word))) return [];
  return [{ loc: '', text: `q: '${word}' follows --path ${flags.paths.at(-1)} and was searched for as text; it also names a path here. To search several paths repeat the flag: --path ${flags.paths.at(-1)} --path ${word}` }];
}
