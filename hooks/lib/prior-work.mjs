// prior-work.mjs — earlier uncommitted work left in a checkout: untracked source files and stashes (KIT-T1553). An agent that
// builds a mechanism without reading what is already there builds it twice: an untracked file was read as another writer's to
// leave alone, a stash was never opened.
//
//   priorWork(tree, { paths, minAgeMs, now }) -> { untracked: [{ path, ageMs }], stashes: [{ ref, subject, ageMs, files }] }
//     tree: the checkout root; its submodules are searched too, their paths prefixed with the submodule folder
//     paths: repo-relative files or folders; an untracked file or a stash touching none of them is left out ('*' or none: every one)
//     minAgeMs: leave out what is younger (orient lists what is older than a day)
//   formatAge(ms)                            -> '3d', '5h' or '12m'
//   priorWorkLines(found, { max })           -> the printable lines of a result, each item with its age

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { overlaps } from './path-overlap.mjs';
import { isSourcePath } from './source-path.mjs';

const MINUTE_MS = 60000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SECONDS_MS = 1000;
const STASH_FIELD = '\t';
const STASH_FORMAT = ['%gd', '%ct', '%gs'].join('%x09');
const DEFAULT_SHOWN = 8;

export const formatAge = (ms) => (ms >= DAY_MS ? `${Math.floor(ms / DAY_MS)}d` : ms >= HOUR_MS ? `${Math.floor(ms / HOUR_MS)}h` : `${Math.max(0, Math.floor(ms / MINUTE_MS))}m`);

const slash = (p) => String(p).replace(/\\/g, '/');
const everything = (paths) => !paths || !paths.length || paths.includes('*');

// The checkout and each submodule folder that exists, as { dir, prefix }.
function repositories(tree) {
  const listed = gitTry(['config', '-f', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$'], tree);
  const subs = listed.ok ? listed.out.split('\n').map((l) => l.trim().split(/\s+/)[1]).filter(Boolean) : [];
  return [{ dir: tree, prefix: '' }, ...subs.filter((s) => existsSync(join(tree, s))).map((s) => ({ dir: join(tree, s), prefix: `${slash(s)}/` }))];
}

function untrackedSources({ dir, prefix }, paths, now, minAgeMs) {
  const listed = gitTry(['ls-files', '--others', '--exclude-standard', '-z'], dir);
  if (!listed.ok) return [];
  return listed.out.split('\0').filter(Boolean).map(slash).filter((rel) => isSourcePath(rel)).flatMap((rel) => {
    const path = `${prefix}${rel}`;
    if (!everything(paths) && !overlaps(paths, [path])) return [];
    try {
      const ageMs = now - statSync(join(dir, rel)).mtimeMs;
      return ageMs >= minAgeMs ? [{ path, ageMs }] : [];
    } catch {
      return [];
    }
  });
}

// The files a stash entry holds: tracked changes, then the untracked files it saved (its third parent).
function stashFiles(dir, ref) {
  const tracked = gitTry(['stash', 'show', '--name-only', ref], dir);
  const untracked = gitTry(['ls-tree', '-r', '--name-only', `${ref}^3`], dir);
  return [...(tracked.ok ? tracked.out.split('\n') : []), ...(untracked.ok ? untracked.out.split('\n') : [])].map((f) => slash(f.trim())).filter(Boolean);
}

function stashesIn({ dir, prefix }, paths, now, minAgeMs) {
  const listed = gitTry(['stash', 'list', `--format=${STASH_FORMAT}`], dir);
  if (!listed.ok) return [];
  return listed.out.split('\n').filter(Boolean).flatMap((line) => {
    const [ref, seconds, subject = ''] = line.split(STASH_FIELD);
    const ageMs = now - Number(seconds) * SECONDS_MS;
    if (!(ageMs >= minAgeMs)) return [];
    const files = stashFiles(dir, ref).map((f) => `${prefix}${f}`);
    if (!everything(paths) && !overlaps(paths, files)) return [];
    return [{ ref: prefix ? `${prefix.slice(0, -1)} ${ref}` : ref, subject, ageMs, files }];
  });
}

export function priorWork(tree, { paths = null, minAgeMs = 0, now = Date.now() } = {}) {
  try {
    const repos = repositories(tree);
    return {
      untracked: repos.flatMap((r) => untrackedSources(r, paths, now, minAgeMs)),
      stashes: repos.flatMap((r) => stashesIn(r, paths, now, minAgeMs)),
    };
  } catch {
    return { untracked: [], stashes: [] };
  }
}

export function priorWorkLines({ untracked, stashes }, { max = DEFAULT_SHOWN } = {}) {
  const more = (shown, all) => (all.length > shown.length ? [`  +${all.length - shown.length} more`] : []);
  const stashShown = stashes.slice(0, max);
  const fileShown = [...untracked].sort((a, b) => b.ageMs - a.ageMs).slice(0, max);
  return [
    ...stashShown.map((s) => `  stash ${s.ref} (${formatAge(s.ageMs)} old): ${s.subject}`),
    ...more(stashShown, stashes),
    ...fileShown.map((f) => `  untracked ${f.path} (${formatAge(f.ageMs)} old)`),
    ...more(fileShown, untracked),
  ];
}
