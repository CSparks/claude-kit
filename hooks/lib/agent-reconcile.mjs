// Reconcile in-flight roster rows whose agent died without a SubagentStop (KIT-T428).
// A usage-limit 429 kills a subagent silently; its row would stay `in-flight` forever. For each
// in-flight row older than the stale window, the freshest written transcript of the agent decides (its subagent
// transcript, or a non-empty outputFile; a foreground agent's outputFile stays empty and says nothing):
//   last entry is a rate/usage-limit error -> status 'killed', reason 'usage-limit'
//   no completion and transcript idle >30m -> status 'stale'
// A row without a written transcript is left alone (cannot tell dead from slow). The verdict is
// APPENDED via the injected `update` (append-only; no row is ever deleted) with the target
// repo's uncommitted files as `wip`, so the resume knows what to recover.

import { readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { wipSummary } from './git-state.mjs';
import { transcriptPaths } from './subagent-transcript.mjs';

export const RECONCILE_AGE_MS = 30 * 60 * 1000;
export const TRANSCRIPT_IDLE_MS = 30 * 60 * 1000;
const TAIL_BYTES = 16 * 1024;
const WIP_MAX = 12;
const LIMIT_RE = /usage[ _-]?limit|rate[ _-]?limit|\b429\b|limit (?:reached|exceeded)|too many requests|resets? at/i;

function tailText(path) {
  const fd = openSync(path, 'r');
  try {
    const size = statSync(path).size;
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

function lastEntry(path) {
  const lines = tailText(path).split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

// The freshest written transcript of the row decides (subagent-transcript.mjs); a row with none is left alone.
export function transcriptVerdict(row, nowMs, options) {
  try {
    const stamped = transcriptPaths(row, options).map((path) => ({ path, mtime: statSync(path).mtimeMs }));
    if (!stamped.length) return null;
    const freshest = stamped.reduce((a, b) => (b.mtime > a.mtime ? b : a));
    if (LIMIT_RE.test(lastEntry(freshest.path))) return { status: 'killed', reason: 'usage-limit' };
    return nowMs - freshest.mtime > TRANSCRIPT_IDLE_MS ? { status: 'stale', reason: 'idle-no-completion' } : null;
  } catch {
    return null;
  }
}

// `rows` is the collapsed roster; returns the verdict rows written. `wipOf(repo)` is injectable.
export function reconcileAgents(root, rows, { update, nowMs = Date.now(), wipOf = (r) => wipSummary(r).dirty, claudeHome } = {}) {
  const done = [];
  for (const r of rows) {
    if (r.status !== 'in-flight') continue;
    const t = Date.parse(r.firstSeen || r.ts || '');
    if (!Number.isFinite(t) || nowMs - t < RECONCILE_AGE_MS) continue;
    const verdict = transcriptVerdict(r, nowMs, { claudeHome });
    if (!verdict) continue;
    let wip = [];
    try { wip = wipOf(r.targetRoot || root).slice(0, WIP_MAX); } catch { /* wip is advisory */ }
    const patch = { ...verdict, ...(wip.length ? { wip } : {}), source: 'orient-reconcile' };
    update(root, r.id, { status: patch.status, ...patch });
    done.push({ ...r, ...patch });
  }
  return done;
}
