// The ignored part of a repo's working tree, taken before a shell call and compared after it (source-shell-write, KIT-T1160).
// `git status` stops listing a file once a rule ignores it, so a call that writes source and then ignores it is invisible to
// the dirty-file snapshot. This reads the ignore state directly.
//
//   ignoreSnapshot(root) -> { rules, config, entries, truncated }
//     rules      { [rule file]: sha1 }  every .gitignore (also an ignored one), .git/info/exclude and the global excludes file that exists
//     config     { excludes, info }     the resolved paths of the global excludes file and of info/exclude, whether or not they exist
//     entries    { [path]: true }       every ignored path git lists, an ignored directory collapsed to `dir/`
//     truncated  the entries were cut at ENTRIES_MAX, so they cannot prove a path was ignored before
//   newIgnoredSources(root, before) -> relPaths   hand-authored source files that are ignored now and may have been hidden by
//     the call. Any difference in the ignore rules (a rule file added, removed or changed, either config path moved) lists every
//     ignored source `before` did not cover, whichever rule ignores it; with the rules untouched every ignored path is the
//     work of a rule that existed before the call and nothing is listed. [] when `before` is missing.
//     The ignored list read after the call is never cut.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { git } from './exec.mjs';
import { isGeneratedPath, isSourcePath, slashed } from './source-path.mjs';

const ENTRIES_MAX = 5000;
const LIST_IGNORED = ['ls-files', '-z', '--others', '--ignored', '--exclude-standard'];

const normalized = (p) => (process.platform === 'win32' ? slashed(resolve(p)).toLowerCase() : resolve(p));
const sha = (path) => { try { return createHash('sha1').update(readFileSync(path)).digest('hex'); } catch { return ''; } };
const lines = (text) => text.split('\0').filter(Boolean);

function capture(root) {
  const nested = lines(git(['ls-files', '-z', '--cached', '--others', '--', '.gitignore', '*/.gitignore'], root)).map((rel) => join(root, rel));
  const excludes = git(['config', '--type=path', '--get', 'core.excludesFile'], root).trim()
    || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'git', 'ignore');
  const infoPath = git(['rev-parse', '--git-path', 'info/exclude'], root).trim();
  const info = infoPath ? resolve(root, infoPath) : '';
  const rules = {};
  for (const file of [...nested, excludes, info].filter((p) => p && existsSync(p))) rules[normalized(file)] = sha(file);
  return {
    rules,
    config: { excludes: normalized(excludes), info: info && normalized(info) },
    listed: lines(git([...LIST_IGNORED, '--directory'], root)),
  };
}

export function ignoreSnapshot(root) {
  const { rules, config, listed } = capture(root);
  const entries = {};
  for (const rel of listed.slice(0, ENTRIES_MAX)) entries[rel] = true;
  return { rules, config, entries, truncated: listed.length > ENTRIES_MAX };
}

const sameRules = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((name) => a[name] === b[name]);

const covered = (before, rel) => {
  if (before.truncated) return false;
  if (before.entries[rel]) return true;
  for (let i = rel.indexOf('/'); i !== -1; i = rel.indexOf('/', i + 1)) if (before.entries[rel.slice(0, i + 1)]) return true;
  return false;
};

const sourcesIn = (root, entry) => (entry.endsWith('/') ? lines(git([...LIST_IGNORED, '--', entry], root)) : [entry]).filter((rel) => isSourcePath(rel));

export function newIgnoredSources(root, before) {
  if (!before || !before.entries || !before.rules || !before.config) return [];
  const { rules, config, listed } = capture(root);
  if (sameRules(before.rules, rules) && before.config.excludes === config.excludes && before.config.info === config.info) return [];
  return listed.filter((rel) => !covered(before, rel) && !isGeneratedPath(rel)).flatMap((entry) => sourcesIn(root, entry));
}
