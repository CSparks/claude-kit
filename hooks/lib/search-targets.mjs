// search-targets.mjs — what a grep-family search is pointed at, for the retrieval gate (KIT-T1069).
//
//   searchPaths(args, { git }) -> [path]   the path operands of a search: flags, flag values and the pattern dropped.
//     git: `args` follow `git grep`; the tokens after `--` are the pathspecs, and revisions before it are not paths.
//   targetsOnlyFiles(paths) -> boolean     true when there is at least one path and every one is a concrete file
//
// A short-flag bundle whose last letter takes a value (`-nA 3`) consumes the next word; an attached value (`-nA3`) does not.
// One named file is a targeted look; a directory, a glob or a mix of files and directories is discovery, so a single
// file operand never launders the rest.

import { hasGlob } from './store-search.mjs';

const VALUE_FLAG = new RegExp(
  '^(?:-[A-Za-z]*[ABCmgtTjdO]|--(?:include|exclude|exclude-dir|exclude-from|glob|iglob|type|type-not|type-add|max-count|max-depth|' +
  'max-columns|max-filesize|context|after-context|before-context|threads|ignore-file|colors|color|sort|sortr|pre|pre-glob|' +
  'encoding|engine|path-separator|context-separator|field-match-separator|dfa-size-limit|regex-size-limit|binary-files|devices|directories|label))$');
const PATTERN_FLAG = /^(?:-[A-Za-z]*[ef]|--regexp|--file)$/;
const FILE_NAME = /\.[A-Za-z0-9]{1,6}$/;
const unquote = (a) => a.replace(/^["']|["']$/g, '');

export function searchPaths(args, { git = false } = {}) {
  const dashes = args.indexOf('--');
  if (git && dashes >= 0) return args.slice(dashes + 1).map(unquote);
  const positionals = [];
  let patternByFlag = false;
  let flagsEnded = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!flagsEnded && a === '--') { flagsEnded = true; continue; }
    if (flagsEnded || !a.startsWith('-') || a === '-') { positionals.push(unquote(a)); continue; }
    if (PATTERN_FLAG.test(a)) { patternByFlag = true; i++; } else if (VALUE_FLAG.test(a)) i++;
  }
  return patternByFlag ? positionals : positionals.slice(1);
}

export const isConcreteFile = (path) => FILE_NAME.test(path) && !hasGlob(path) && !/[\\/]$/.test(path);

export const targetsOnlyFiles = (paths) => paths.length > 0 && paths.every(isConcreteFile);
