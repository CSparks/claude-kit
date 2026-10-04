// health.mjs — the broker's self-check (KIT-T307). `selfCheck(cfg)` looks for the broker's own
// faults, writes them to health.json (health-store.mjs), and returns { entries, fresh }:
//   no-daemon        jobs are queued and no live daemon holds the lock
//   dirt-from-own-run the queue is paused on a path the last job or re-check wrote or journalled
//   stuck-inflight   an inflight job is older than 3x the longest recent command
//   own-fault        a fault recorded by recordFault (gate crash, journal/restore mismatch)
// Every entry is { kind, since, detail, cause }; `cause` names the likely cause and the kit ticket
// to file. With `heal`, a dirt-from-own-run path that was clean before the run is put back from
// the journalled pre-image; the daemon passes it, wait/submit never do.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, repoByName } from './config.mjs';
import { catBlob, dirtyPaths, revParse } from './git.mjs';
import { liveHolder, observedLive } from './lock.mjs';
import { readInflight } from './preimage.mjs';
import { listQueue, readResult, STATUS } from './result.mjs';
import { readHealth, readRun, recentFaults, writeHealth } from './health-store.mjs';

export const OWN_DIRT_WINDOW_MS = 10_000;
const STUCK_FACTOR = 3;
const STUCK_FLOOR_MS = 120_000;
const RECENT_RESULTS = 10;
const FAULT_AGE_MS = 60 * 60 * 1000;

const ticketHint = (kind, what) => `file: cap bug "broker self-check ${kind}: ${what}"`;

const pathOf = (entry) => entry.replace(/^\S+\s+/, '');

export function noDaemon(cfg) {
  const queued = listQueue(cfg);
  if (!queued.length || observedLive(cfg)) return [];
  return [{ kind: 'no-daemon', detail: `${queued.length} job(s) queued, no live broker holds the lock`,
    cause: `the daemon exited (idle-exit, crash or stop) and nothing restarted it; start: node broker.mjs --root ${cfg.root}; ${ticketHint('no-daemon', 'jobs queued without a daemon')}` }];
}

const mtimeMs = (abs) => { try { return statSync(abs).mtimeMs; } catch { return null; } };

// A dirty path belongs to the run when it changed after the run began and either the run journalled it
// or it changed within seconds of the run ending.
function ownedByRun(abs, path, run, journalled) {
  const m = mtimeMs(abs);
  if (m === null || m < Date.parse(run.startedAt)) return false;
  return journalled.has(path) || m <= Date.parse(run.endedAt) + OWN_DIRT_WINDOW_MS;
}

export function ownDirt(cfg, run, heal) {
  if (!run) return [];
  const journalled = new Map(run.entries.map((e) => [e.path, e.blob]));
  const out = [];
  for (const job of listQueue(cfg)) {
    const r = readResult(cfg, job.id);
    const repo = r && r.status === STATUS.DIRTY && r.repo === run.repo ? repoByName(cfg, r.repo) : null;
    if (!repo || out.some((o) => o.repo === r.repo)) continue;
    const cwd = join(cfg.root, repo.path);
    const dirty = new Set(dirtyPaths(cwd));
    const paths = (r.dirtyEntries || []).map(pathOf).filter((p) => dirty.has(p) && ownedByRun(join(cwd, p), p, run, journalled));
    if (!paths.length) continue;
    const healed = heal ? healPaths(cwd, paths, run, journalled) : [];
    out.push({ kind: 'dirt-from-own-run', repo: r.repo, detail: `${r.repo}: ${paths.join(', ')} changed by the broker's own ${run.kind} ${run.id}${healed.length ? `; restored ${healed.join(', ')} from the journal` : ''}`,
      cause: `the ${run.kind} left a build-written path behind (cargo rewrote it after the journal restore, or the restore missed it); ${ticketHint('dirt-from-own-run', paths[0])}` });
  }
  return out;
}

// Safe only for a path that was clean going in (pre-image == HEAD) and changed within seconds of the run's end.
function healPaths(cwd, paths, run, journalled) {
  const healed = [];
  for (const p of paths) {
    const blob = journalled.get(p);
    const m = mtimeMs(join(cwd, p));
    if (!blob || blob !== revParse(cwd, `HEAD:${p}`) || m > Date.parse(run.endedAt) + OWN_DIRT_WINDOW_MS) continue;
    const bytes = catBlob(cwd, blob);
    if (bytes) { writeFileSync(join(cwd, p), bytes); healed.push(p); }
  }
  return healed;
}

function longestRecentCommandMs(cfg) {
  let dir;
  try { dir = readdirSync(brokerPaths(cfg).results).filter((f) => f.endsWith('.json')).sort().slice(-RECENT_RESULTS); } catch { return 0; }
  let longest = 0;
  for (const f of dir) {
    try { for (const c of JSON.parse(readFileSync(join(brokerPaths(cfg).results, f), 'utf8')).commands || []) longest = Math.max(longest, c.durationMs || 0); } catch { /* unreadable result */ }
  }
  return longest;
}

export function stuckInflight(cfg, nowMs, floorMs = STUCK_FLOOR_MS) {
  const inflight = readInflight(cfg);
  if (!inflight || !liveHolder(cfg)) return [];
  const limit = Math.max(STUCK_FACTOR * longestRecentCommandMs(cfg), floorMs);
  const age = nowMs - Date.parse(inflight.startedAt);
  if (age <= limit) return [];
  return [{ kind: 'stuck-inflight', detail: `job ${inflight.id} inflight ${Math.round(age / 1000)}s, over ${STUCK_FACTOR}x the longest recent command (${Math.round(limit / 1000)}s limit)`,
    cause: `a command hung or the daemon is wedged mid-run; ${ticketHint('stuck-inflight', inflight.id)}` }];
}

export function ownFaults(cfg, nowMs) {
  return recentFaults(cfg, nowMs, FAULT_AGE_MS).map((f) => ({ kind: `own-fault:${f.kind}`, detail: `job ${f.id}: ${f.detail}`,
    cause: `${f.kind === 'gate-crash' ? 'the pre-write gate hook crashed instead of answering' : 'the tree after a restore differs from its journal'}; ${ticketHint(f.kind, f.id)}` }));
}

/** Run every detector, persist health.json (keeping `since` of continuing entries), return { entries, fresh }. */
export function selfCheck(cfg, { now = Date.now(), heal = false, stuckFloorMs, skipNoDaemon = false } = {}) {
  const found = [...(skipNoDaemon ? [] : noDaemon(cfg)), ...ownDirt(cfg, readRun(cfg), heal), ...stuckInflight(cfg, now, stuckFloorMs), ...ownFaults(cfg, now)];
  const before = readHealth(cfg);
  const known = (e) => before.find((b) => b.kind === e.kind && b.detail === e.detail);
  const entries = found.map(({ kind, detail, cause }) => ({ kind, since: (known({ kind, detail }) || {}).since || new Date(now).toISOString(), detail, cause }));
  if (JSON.stringify(entries) !== JSON.stringify(before)) writeHealth(cfg, entries);
  return { entries, fresh: entries.filter((e) => !known(e)) };
}

export const healthLine = (e) => `broker HEALTH ${e.kind}: ${e.detail} (likely: ${e.cause})`;

/** Print each entry's line once per `seen` set (a process's memory of what it already said). */
export function announce(entries, seen, log = console.error) {
  for (const e of entries) {
    const line = healthLine(e);
    if (!seen.has(line)) { seen.add(line); log(line); }
  }
}
