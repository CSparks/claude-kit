// The ignored part of a repo's working tree, taken before a shell call and compared after it (source-shell-write, KIT-T1160).
// `git status` stops listing a file once a rule ignores it, so a call that writes source and then ignores it is invisible to
// the dirty-file snapshot. This reads the ignore state directly.
//
//   ignoreSnapshot(root) -> { rules, entries }
//     rules    { [absolute rule file]: sha1 }  every .gitignore, .git/info/exclude and the global excludes file that exists
//     entries  { [path]: true }                every ignored path git lists, an ignored directory collapsed to `dir/`
//   newIgnoredSources(root, before) -> relPaths   hand-authored source files that are ignored now, were not covered by an
//     entry of `before`, and whose ignoring rule lives in a file that is new or changed since `before`. A file a rule
//     that existed before the call ignores (a build writing into `out/` under an old `out/` rule) is not listed.
//     [] when `before` is missing.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { git } from './exec.mjs';
import { isGeneratedPath, isSourcePath, slashed } from './source-path.mjs';

const ENTRIES_MAX = 5000;
const LIST_IGNORED = ['ls-files', '-z', '--others', '--ignored', '--exclude-standard'];
const CHECK_FIELDS = 4;

const normalized = (p) => (process.platform === 'win32' ? slashed(resolve(p)).toLowerCase() : resolve(p));
const sha = (path) => { try { return createHash('sha1').update(readFileSync(path)).digest('hex'); } catch { return ''; } };
const lines = (text) => text.split('\0').filter(Boolean);

function ruleFiles(root) {
  const nested = lines(git(['ls-files', '-z', '--cached', '--others', '--', '.gitignore', '*/.gitignore'], root));
  const excludes = git(['config', '--type=path', '--get', 'core.excludesFile'], root).trim()
    || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'git', 'ignore');
  const info = git(['rev-parse', '--git-path', 'info/exclude'], root).trim();
  return [...nested.map((rel) => join(root, rel)), excludes, info ? resolve(root, info) : ''].filter((p) => p && existsSync(p));
}

export function ignoreSnapshot(root) {
  const rules = {};
  for (const file of ruleFiles(root)) rules[normalized(file)] = sha(file);
  const entries = {};
  for (const rel of lines(git([...LIST_IGNORED, '--directory'], root)).slice(0, ENTRIES_MAX)) entries[rel] = true;
  return { rules, entries };
}

const covered = (entries, rel) => {
  if (entries[rel]) return true;
  for (let i = rel.indexOf('/'); i !== -1; i = rel.indexOf('/', i + 1)) if (entries[rel.slice(0, i + 1)]) return true;
  return false;
};

// The rule file that ignores each path (`git check-ignore -v`), or '' for a path no rule matches.
function ruleSources(root, paths) {
  if (!paths.length) return new Map();
  let out = '';
  try {
    out = execFileSync('git', ['check-ignore', '-v', '-z', '--stdin'], { cwd: root, input: paths.join('\0'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  } catch (e) { out = (e && e.stdout && e.stdout.toString()) || ''; }
  const fields = lines(out);
  const found = new Map();
  for (let i = 0; i + CHECK_FIELDS <= fields.length; i += CHECK_FIELDS) found.set(fields[i + CHECK_FIELDS - 1], fields[i]);
  return found;
}

const sourcesIn = (root, entry) => (entry.endsWith('/') ? lines(git([...LIST_IGNORED, '--', entry], root)) : [entry])
  .filter((rel) => isSourcePath(rel));

export function newIgnoredSources(root, before) {
  if (!before || !before.entries) return [];
  const listed = lines(git(LIST_IGNORED.concat('--directory'), root)).slice(0, ENTRIES_MAX);
  const files = listed.filter((rel) => !covered(before.entries, rel) && !isGeneratedPath(rel)).flatMap((entry) => sourcesIn(root, entry));
  const sources = ruleSources(root, files);
  return files.filter((rel) => {
    const rule = sources.get(rel);
    if (!rule) return true;
    const file = isAbsolute(rule) ? rule : resolve(root, rule);
    const known = before.rules && before.rules[normalized(file)];
    return !known || known !== sha(file);
  });
}
