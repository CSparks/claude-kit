// --- closure nags (KIT-T062) ----------------------------------------------------
// The intake side is loud (request-gate, capture ratchet); the CLOSURE side rotted
// silently (inbox sat days untriaged, review piled up, SESSION went stale). These
// shared scanners feed the SessionStart/Stop nags in housekeeping + orient. Every one
// is FAIL-OPEN: any read/parse slip returns the empty/clean result, never throws — a
// nag must never wedge a session (the hook contract).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ageDays } from './time.mjs';
import { uatDefault } from './config.mjs';

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

// A ticket file's frontmatter `status` and per-ticket `uat:` override (either may be '').
// Tolerant line-wise parse mirroring survey/t — only the two fields the review scan needs.
function ticketStatusAndUat(text) {
  const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const pick = (k) => {
    const m = fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return { status: pick('status'), uat: pick('uat') };
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
    const dir = join(root, '.ai', 'tickets');
    const def = uatDefault(root);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('_') || f === 'INDEX.md') continue;
      const path = join(dir, f);
      let text;
      try { text = readFileSync(path, 'utf8'); } catch { continue; }
      const { status, uat } = ticketStatusAndUat(text);
      if (status !== 'review') continue;
      if ((uat || def) !== 'required') continue; // `none` → not a human-waiting queue
      out.count++;
      const id = (text.match(/^id:[ \t]*(.+)$/m) || [, f.replace(/\.md$/, '')])[1].trim();
      out.ids.push(id);
      const age = ageDays(path);
      if (age !== null && age > out.oldestDays) out.oldestDays = age;
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
    const dir = join(root, '.ai', 'tickets');
    const now = Date.now();
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('_') || f === 'INDEX.md') continue;
      const path = join(dir, f);
      let text;
      try { text = readFileSync(path, 'utf8'); } catch { continue; }
      const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
      const pick = (k) => { const m = fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
      if (pick('status') !== 'doing') continue;
      const id = pick('id') || f.replace(/\.md$/, '');
      // Parse `updated:` ISO field; fall back to file mtime.
      let ageMs = 0;
      const updatedStr = pick('updated');
      if (updatedStr) {
        const ts = Date.parse(updatedStr);
        if (Number.isFinite(ts)) ageMs = now - ts;
      }
      if (!ageMs) {
        try { ageMs = now - statSync(path).mtimeMs; } catch { continue; }
      }
      if (ageMs < thresholdMs) continue; // recently active — not stale
      out.count++;
      out.ids.push(id);
      if (ageMs > out.oldestMs) out.oldestMs = ageMs;
    }
  } catch {
    /* no tickets dir / unreadable — nothing to nag about */
  }
  return out;
}
