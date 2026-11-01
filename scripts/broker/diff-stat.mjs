// diff-stat.mjs — a job's `git diff --stat` with each edited submodule expanded to the files inside it (KIT-T801).
// The super repo's stat shows a submodule edit as one line ("rapid-game | 0"), so timing-reach could not place
// the edit in a crate and billed the dependents it rebuilt as waste. The expanded lines carry the submodule
// path as a prefix ("rapid-game/crates/rg-physics/src/lib.rs | 3 +-"), placed under the checkout root.
//
//   diffStatOf(cwd, paths?) -> the stat text; `paths` limits the super repo's diff like `git diff --stat -- <paths>`
//   STAT_WIDTH              -> the column width git gets, wide enough that no path is abbreviated with "..."

import { join } from 'node:path';
import { git } from './git.mjs';

export const STAT_WIDTH = 400;
const SUBMODULE_MODE = /^160000 /;
const STAT_LINE = /^(\s*)(\S.*?)(\s+\|.*)$/;

function submodulePaths(cwd) {
  return new Set(git(['ls-files', '--stage'], cwd).out.split('\n').filter((l) => SUBMODULE_MODE.test(l)).map((l) => l.split('\t')[1]));
}

function expandLine(line, cwd, subs) {
  const m = STAT_LINE.exec(line);
  if (!m || !subs.has(m[2])) return [line];
  const inner = git(['diff', `--stat=${STAT_WIDTH}`], join(cwd, m[2])).out.split('\n').filter((l) => STAT_LINE.test(l));
  return inner.length ? inner.map((l) => l.replace(STAT_LINE, (_, pad, path, rest) => `${pad}${m[2]}/${path}${rest}`)) : [line];
}

export function diffStatOf(cwd, paths = []) {
  const stat = git(['diff', `--stat=${STAT_WIDTH}`, ...(paths.length ? ['--', ...paths] : [])], cwd).out;
  const subs = submodulePaths(cwd);
  return subs.size ? stat.split('\n').flatMap((line) => expandLine(line, cwd, subs)).join('\n') : stat;
}
