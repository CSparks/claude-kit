// --- closure nags (KIT-T062) ----------------------------------------------------
// The intake side is loud (request-gate, capture ratchet); the CLOSURE side rotted
// silently (inbox sat days untriaged, review piled up, SESSION went stale). These
// shared scanners feed the SessionStart/Stop nags in housekeeping + orient. Every one
// is FAIL-OPEN: any read/parse slip returns the empty/clean result, never throws — a
// nag must never wedge a session (the hook contract).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ageDays, MS_PER_DAY } from './time.mjs';
import { uatDefault } from './config.mjs';
import { pathKey, statCached, statMarkdownFiles } from './stat-cache.mjs';

// Untriaged inbox: `.ai/inbox/*.md` (the triaged/ subdir + README are NOT intake).
// triage drains inbox into the durable stores, so a file lingering here past a
// threshold is un-actioned capture. Returns { total, stale, oldestDays } where `stale`
// counts files older than thresholdDays. Empty/clean ({total:0}) on any error.
export function scanInbox(root, thresholdDays) {
  const out = { total: 0, stale: 0, oldestDays: 0 };
  try {
    const dir = join(root, '.ai', 'inbox');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
    for (const f of files) {
      const age = ageDays(join(dir, f));
      if (age === null) continue;
      out.total++;
      if (age > out.oldestDays) out.oldestDays = age;
      if (age >= thresholdDays) out.stale++;
    }
  } catch {
    /* no inbox dir / unreadable — nothing to nag about */
  }
  return out;
}

// Frontmatter facts of one ticket file: the fields the closure scans need, read tolerantly
// line-wise (mirrors survey/t). Everything is a string; absent fields are ''.
function parseTicketHead(path) {
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { /* unreadable — empty head */ }
  const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const pick = (k) => {
    const m = fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return { status: pick('status'), uat: pick('uat'), id: pick('id'), updated: pick('updated') };
}

// Heads of every ticket under .ai/tickets, answered from a stat-keyed cache so an unchanged
// ticket is never opened (~1,000 tickets: ~0.4 s of opens per scan without it).
function ticketHeads(root) {
  const dir = join(root, '.ai', 'tickets');
  const files = statMarkdownFiles(dir, (n) => n.startsWith('_') || n === 'INDEX.md');
  const heads = statCached(`ticket-heads-${pathKey(dir)}`, files, parseTicketHead);
  return files.map((f, i) => ({ ...heads[i], file: f.name, mtimeMs: f.mtimeMs }));
}

// Review queue = tickets parked in `status: review` whose UAT resolves `required` (so the
// stage genuinely waits on the human — a per-ticket `uat:` beats the project default). Where
// uat resolves `none` the project closes its own work, so the queue is empty BY CONSTRUCTION
// and the caller's nag stays silent. Returns { count, oldestDays, ids } (waiting-ticket count,
// the oldest by file mtime, and their ids for a short-list render). Clean ({count:0}) on any
// error or when uat is project-wide `none`.
export function scanReviewQueue(root) {
  const out = { count: 0, oldestDays: 0, ids: [] };
  try {
    const def = uatDefault(root);
    const now = Date.now();
    for (const t of ticketHeads(root)) {
      if (t.status !== 'review') continue;
      if ((t.uat || def) !== 'required') continue; // `none` → not a human-waiting queue
      out.count++;
      out.ids.push(t.id || t.file.replace(/\.md$/, ''));
      const age = Math.floor((now - t.mtimeMs) / MS_PER_DAY);
      if (age > out.oldestDays) out.oldestDays = age;
    }
  } catch {
    /* no tickets dir / unreadable — empty queue */
  }
  return out;
}

// Stale `doing` tickets — tickets parked in `status: doing` with no `updated` timestamp
// newer than thresholdMs. A zombie `doing` happens when an agent dies or bails without
// flipping the status back to `todo` (or forward to `review`). Surfaces in orient +
// housekeeping so a stale `doing` can't hide indefinitely.
//
// Age source: the ticket's `updated:` ISO frontmatter field (written by `t status`);
// falls back to file mtime when the field is absent or unparseable. FAIL-OPEN:
// any read/parse error returns the clean result — a nag must never wedge a session.
// Returns { count, ids, oldestMs } where `oldestMs` is the age of the oldest stale
// doing ticket in milliseconds (for callers that want to format as hours/days).
export function scanStaleDoingTickets(root, thresholdMs) {
  const out = { count: 0, ids: [], oldestMs: 0 };
  try {
    const now = Date.now();
    for (const t of ticketHeads(root)) {
      if (t.status !== 'doing') continue;
      let ageMs = 0;
      const ts = t.updated ? Date.parse(t.updated) : NaN;
      if (Number.isFinite(ts)) ageMs = now - ts;
      if (!ageMs) ageMs = now - t.mtimeMs;
      if (ageMs < thresholdMs) continue; // recently active — not stale
      out.count++;
      out.ids.push(t.id || t.file.replace(/\.md$/, ''));
      if (ageMs > out.oldestMs) out.oldestMs = ageMs;
    }
  } catch {
    /* no tickets dir / unreadable — nothing to nag about */
  }
  return out;
}
