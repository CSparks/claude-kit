// hand-hold.mjs — who holds a paused lane's tree, since when, and what to do about it (KIT-T568).
// A hand-driven writer's changes pause the lane (admit.mjs, dirty.mjs); this module turns the pause
// marker into words for the people stuck behind it.
//
//   entriesText(entries)           -> "M a.rs, ?? b.rs (+3 more)" for a result message
//   untrackedNote(cfg, cwd, entries) -> " — untracked build input matching <glob>: …" when every entry is untracked, else ""
//   rekeyHold(cfg, job, repo)      point the pause marker at the live job and give it its dirty result
//   holdReport(cfg, now?)          -> { repo, job, since, ageMs, entries, lastEditMs, sessions } while the tree is still dirty, else null
//   holdLine(report)               -> one stable line (no ages, so a log note repeats only when the hold changes)
//   holdAge(report)                -> "12 min, newest edit 40 s ago"
//   handHoldEntries(cfg, now?)     -> self-check entries (health.mjs) once the hold outlasts HAND_HOLD_REPORT_MS
//   dirtNotice(cfg)                -> lines for a daemon starting over a dirty lane

import { statSync } from 'node:fs';
import { join } from 'node:path';
import { sessionsWriting } from '../../hooks/turn-writes.mjs';
import { derivedUntrackedBlocks } from './blocks.mjs';
import { repoByName } from './config.mjs';
import { dirtState, holdDirty, readHold } from './dirty.mjs';
import { globToRegExp } from './glob.mjs';
import { listQueue, writeResult } from './result.mjs';

export const HAND_HOLD_REPORT_MS = 5 * 60 * 1000;
const SHOWN_ENTRIES = 4;
const SESSION_ID_CHARS = 8;
const MS_PER_SEC = 1000;
const SEC_PER_MIN = 60;

const pathOf = (entry) => entry.replace(/^\S+\s+/, '');

export function entriesText(entries, shown = SHOWN_ENTRIES) {
  const head = entries.slice(0, shown).join(', ');
  return entries.length > shown ? `${head} (+${entries.length - shown} more)` : head;
}

const UNTRACKED = '?? ';

export function untrackedNote(cfg, cwd, entries) {
  if (!entries.length || !entries.every((e) => e.startsWith(UNTRACKED))) return '';
  const globs = (cfg.untrackedDerived && derivedUntrackedBlocks(cwd)) || cfg.untrackedBlocks;
  const hit = [...new Set(entries.flatMap((e) => globs.filter((g) => globToRegExp(g).test(pathOf(e)))))];
  return ` — untracked build input matching ${(hit.length ? hit : globs).join(', ')}: cargo auto-discovers these`;
}

const mtimeMs = (abs) => { try { return statSync(abs).mtimeMs; } catch { return null; } };

const clock = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function holdReport(cfg, now = Date.now()) {
  const mark = readHold(cfg);
  const repo = mark && repoByName(cfg, mark.repo);
  if (!repo) return null;
  const cwd = join(cfg.root, repo.path);
  const state = dirtState(cfg, repo, cwd, mark.touched || [], { heal: false });
  if (state.clean || !state.entries.length) return null;
  const paths = state.entries.map(pathOf);
  const edits = paths.map((p) => mtimeMs(join(cwd, p))).filter((m) => m !== null);
  return {
    repo: repo.name, job: mark.id, since: mark.since, ageMs: now - Date.parse(mark.since), entries: state.entries,
    lastEditMs: edits.length ? now - Math.max(...edits) : null, sessions: sessionsWriting(cwd, paths), untracked: untrackedNote(cfg, cwd, state.entries),
  };
}

export function holdLine(r) {
  const who = r.sessions.length ? `; probably session ${r.sessions[0].session.slice(0, SESSION_ID_CHARS)} (${r.sessions[0].count} of ${r.entries.length} paths in its write ledger)` : '; no session write ledger names these paths';
  return `hand edits hold the ${r.repo} tree since ${clock(r.since)}: ${entriesText(r.entries)}${r.untracked}${who}; job ${r.job} waits and the queue is paused until they are committed, reverted or stashed`;
}

export function holdAge(r) {
  const min = Math.floor(r.ageMs / MS_PER_SEC / SEC_PER_MIN);
  const edit = r.lastEditMs === null ? '' : `, newest edit ${Math.round(r.lastEditMs / MS_PER_SEC)} s ago`;
  return `${min} min${edit}`;
}

export function handHoldEntries(cfg, now = Date.now(), thresholdMs = HAND_HOLD_REPORT_MS) {
  const mark = readHold(cfg);
  if (!mark || !mark.since || now - Date.parse(mark.since) < thresholdMs) return [];
  const r = holdReport(cfg, now);
  if (!r) return [];
  return [{ kind: 'hand-edit-hold', detail: holdLine(r),
    cause: `a hand-driven writer has held the tree past ${Math.round(thresholdMs / MS_PER_SEC / SEC_PER_MIN)} min: ask that session to commit or revert (or pause the broker while it works: node broker.mjs pause --root ${cfg.root}); the broker resumes by itself once the tree is clean` }];
}

/** Lines for a daemon starting (or being started) over a lane whose tree already holds build-blocking changes. */
export function dirtNotice(cfg) {
  const out = [];
  for (const repo of cfg.repos.filter((r) => Boolean(r.submodule) === Boolean(cfg.lane) && (!cfg.lane || r.name === cfg.lane))) {
    const cwd = join(cfg.root, repo.path);
    const state = dirtState(cfg, repo, cwd, [], { heal: false });
    if (state.clean || !state.entries.length) continue;
    const who = sessionsWriting(cwd, state.entries.map(pathOf))[0];
    out.push(`broker: the ${repo.name} tree is dirty: ${entriesText(state.entries)}${who ? ` (probably session ${who.session.slice(0, SESSION_ID_CHARS)})` : ''}; ${listQueue(cfg).length} queued job(s) pause until it is clean`);
  }
  return out;
}

/** The marker names a job that is gone while the tree is still dirty: name the live one, keep `since`, and tell its worker why it waits. */
export function rekeyHold(cfg, job, repo) {
  const mark = readHold(cfg);
  if (mark && mark.id === job.id) return;
  const cwd = join(cfg.root, repo.path);
  const state = dirtState(cfg, repo, cwd, (job.ops || []).map((o) => String(o.path).split(String.fromCharCode(92)).join('/')), { heal: false });
  holdDirty(cfg, job, repo, state.entries);
  writeResult(cfg, { id: job.id, repo: job.repo, status: 'dirty', phase: 'apply', dirtyEntries: state.entries,
    message: `build checkout dirty (${cwd}): ${entriesText(state.entries)}${untrackedNote(cfg, cwd, state.entries)} — queue paused until these are committed, reverted or stashed` });
}
