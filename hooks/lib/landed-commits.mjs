// landed-commits — which commits count as landed work, and where each stands (KIT-T021, KIT-T1144).
// Shared by the landing-alert Stop hook and the `t receipt` command, so both list the same commits.
//
//   commitsSince(root, { sinceMs, skewMs, author }) -> newest-first { sha, shortSha, subject, ids[], authorEmail }
//                                                      every commit committed at/after sinceMs - skewMs
//   madeLocally(root, { sinceMs, skewMs })          -> Set of shas this clone committed, cherry-picked or rebased itself in the window (HEAD reflog)
//   landedSince(root, window)                     -> commitsSince narrowed to real-work commits; with `ownOnly`, to those this
//                                                    clone made (madeLocally: a pulled commit is another session's landing)
//   touchesProjectFiles(root, sha)                  -> false for a commit that changed only the .ai store
//   landedThisTurn(root, turnStartMs)               -> landedSince with the turn-start clock-skew tolerance
//   isPushed(root)                                  -> true when the repo has a remote and nothing is unpushed anywhere
//   commitState(root, sha)                          -> PUSHED | NOT_PUSHED | LOCAL_ONLY for one commit
//   submodulesOf(root)                              -> absolute paths of every initialized submodule, nested ones too

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { git } from './exec.mjs';
import { wipSummary } from './git-state.mjs';
import { ID_CITE_SRC } from './ids.mjs';

export const TURN_SKEW_MS = 1500;
const MS_PER_SEC = 1000; // git %ct is epoch SECONDS; callers hold ms
const LOG_DEPTH = 50;
const FIELD_SEP = '\x1f'; // unit separator, safe inside a commit subject

// The turn-state slot holding the landing-alert's last listing: { alerted, listed[], turnStartMs, at }.
export const LAND_SLOT = 'land';

export const PUSHED = 'pushed';
export const NOT_PUSHED = 'not pushed';
export const LOCAL_ONLY = 'local only (no remote)';

// Code extensions whose presence makes a commit "real work" (vs docs/config-only noise); kept in
// lock-step with commit-gate.mjs's CODE set.
const CODE = new Set(
  'ts tsx js jsx mjs cjs rs py go java rb php cs swift kt c cc cpp cxx h hpp css scss sass less vue svelte sql'.split(' '),
);
const CITE = new RegExp(ID_CITE_SRC);
const CITE_ALL = new RegExp(ID_CITE_SRC, 'g');

// A commit is real work iff it touches a code file OR cites a ticket id; a docs/config-only,
// un-cited commit is noise.
function isRealWork(root, sha, subject) {
  if (CITE.test(subject)) return true;
  const files = git(['-C', root, 'show', '--name-only', '--pretty=format:', sha]).split('\n');
  return files.some((f) => CODE.has((f.split('.').pop() || '').toLowerCase()));
}

// A commit that changed only the .ai store is bookkeeping: the anchor has nothing new to point at.
export function touchesProjectFiles(root, sha = 'HEAD') {
  const names = git(['-C', root, 'show', '--name-only', '--format=', sha]).split('\n').filter(Boolean);
  return names.some((n) => !n.startsWith('.ai/'));
}

// The author-time filter runs in JS rather than via `git log --since`, so it does not depend on
// commits being in date order. `author`, when set, keeps only commits by that email.
export function commitsSince(root, { sinceMs, skewMs = 0, author = '' }) {
  const tol = sinceMs - skewMs;
  const raw = git(['-C', root, 'log', `--pretty=%H${FIELD_SEP}%h${FIELD_SEP}%ct${FIELD_SEP}%ae${FIELD_SEP}%s`, '-n', String(LOG_DEPTH)]);
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [sha, shortSha, ct, authorEmail, subject = ''] = line.split(FIELD_SEP);
    if (!sha || Number(ct) * MS_PER_SEC < tol) continue;
    if (author && authorEmail !== author) continue;
    out.push({ sha, shortSha, subject, authorEmail, committedMs: Number(ct) * MS_PER_SEC, ids: [...new Set(subject.match(CITE_ALL) || [])] });
  }
  return out;
}

// A reflog message of a commit made here: `commit…`, `cherry-pick…`, and each commit a rebase replays or finishes by hand
// (`rebase (pick|reword|squash|fixup|edit|continue)`, also behind `pull --rebase origin main (…)`). A replayed local commit has
// a new sha and is counted under it; the upstream commits a pull or rebase lands on are `pull`, `checkout` or `fast-forward`.
const MADE_HERE = /^(?:commit\b|cherry-pick\b|.*\((?:pick|reword|squash|fixup|edit|continue)\))/;

// The shas this clone made itself at/after sinceMs - skewMs: HEAD's reflog records a made commit (MADE_HERE) and other
// messages (`pull`, `fetch`, `checkout`, `rebase (start)`, `merge`) for history that arrived from elsewhere.
export function madeLocally(root, { sinceMs, skewMs = 0 }) {
  const raw = git(['-C', root, 'log', '-g', '--date=unix', `--pretty=%H${FIELD_SEP}%gd${FIELD_SEP}%gs`, '-n', String(LOG_DEPTH), 'HEAD']);
  const made = new Set();
  for (const line of raw.split('\n')) {
    const [sha, selector = '', message = ''] = line.split(FIELD_SEP);
    const at = Number((/@\{(\d+)\}/.exec(selector) || [])[1]) * MS_PER_SEC;
    if (sha && MADE_HERE.test(message) && at >= sinceMs - skewMs) made.add(sha);
  }
  return made;
}

// Whether HEAD has any reflog at all: without one, "made here" cannot be told from "pulled in", and the filter stays off.
const hasReflog = (root) => git(['-C', root, 'reflog', '-n', '1', 'HEAD']).trim() !== '';

// `ownOnly` keeps the commits this clone made in the window (madeLocally): a commit that arrived by pull, fetch or merge, pushed
// by another session before this turn began, is no landing of this one (KIT-T1278).
export function landedSince(root, window) {
  const own = window.ownOnly && hasReflog(root) ? madeLocally(root, window) : null;
  return commitsSince(root, window).filter((c) => (!own || own.has(c.sha)) && isRealWork(root, c.sha, c.subject));
}

export const landedThisTurn = (root, turnStartMs) => landedSince(root, { sinceMs: turnStartMs, skewMs: TURN_SKEW_MS, ownOnly: true });

const hasRemote = (root) => !!git(['-C', root, 'remote']).trim();

// A remote-less repo has nowhere to push to, so it never claims "pushed/building".
export function isPushed(root) {
  if (!hasRemote(root)) return false;
  return wipSummary(root).unpushed.length === 0;
}

// `rev-list <sha> --not --remotes` prints the sha only when no remote-tracking ref reaches it.
export function commitState(root, sha) {
  if (!hasRemote(root)) return LOCAL_ONLY;
  return git(['-C', root, 'rev-list', '-n', '1', sha, '--not', '--remotes']).trim() ? NOT_PUSHED : PUSHED;
}

// Submodule paths come from .gitmodules (never `submodule foreach`, which spawns a shell); one that
// is not checked out has no .git entry and is skipped.
export function submodulesOf(root) {
  const raw = git(['-C', root, 'config', '-f', '.gitmodules', '-z', '--get-regexp', String.raw`^submodule\..*\.path$`]);
  const found = [];
  for (const entry of raw.split('\0').filter(Boolean)) {
    const rel = entry.slice(entry.indexOf('\n') + 1);
    const abs = resolve(root, rel);
    if (!rel || !existsSync(join(abs, '.git'))) continue;
    found.push(abs, ...submodulesOf(abs));
  }
  return found;
}
