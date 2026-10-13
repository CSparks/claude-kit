// landed.mjs — commits that implement a ticket, recorded as `(landed)` History lines (KIT-T444).
// A ticket whose commits are in git but whose criteria stay unticked reads as unbuilt to every
// later grounding; the stamp, `q show`, orient and the `t status todo` guard all derive from
// these lines, so the History is the one source.
//
//   - [YYYY-MM-DD HH:MM] (landed) <short sha> <subject, first 120 chars>
//
//   stampLanded(text, sha, subject)   -> new ticket text, or null when that sha is already stamped
//   landedLine(text)                  -> 'LANDED COMMITS: n (last <sha> <date>)' or ''
//   remainingNote(id, state, text, remaining) -> the comment to record, or throws when the flip is refused
//   builtButUnticked(root)            -> [{ id, title, status, count }] todo/doing tickets with landed commits

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ID_CITE_SRC } from '../hooks/lib/ids.mjs';
import { splitFrontmatter, field } from './frontmatter.mjs';
import { appendUnderSection, stamp } from './md-body.mjs';

const SUBJECT_MAX = 120;
const MIN_SHA = 7;
const LANDED = /^- \[(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}\] \(landed\) ([0-9a-f]{7,40})\b/gm;
const IMPLEMENTS = new RegExp(String.raw`\bimplements\s+(${ID_CITE_SRC}(?:\s*(?:,|and|&|\+)\s*${ID_CITE_SRC})*)`, 'gi');
const TICKET_ID = /-T\d+$/;
const OPEN_STATES = new Set(['todo', 'doing']);

/** Ticket ids a commit subject says it implements: "implements KIT-T1" / "implements ST-T2, RG-T3". */
export function implementedIds(subject) {
  const ids = new Set();
  for (const m of String(subject).matchAll(IMPLEMENTS)) {
    for (const id of m[1].match(new RegExp(ID_CITE_SRC, 'g'))) if (TICKET_ID.test(id)) ids.add(id);
  }
  return [...ids];
}

const entries = (text) => [...String(text).matchAll(LANDED)].map((m) => ({ date: m[1], sha: m[2] }));
const same = (a, b) => a.startsWith(b) || b.startsWith(a);

export function landedLine(text) {
  const all = entries(text);
  const last = all[all.length - 1];
  return last ? `LANDED COMMITS: ${all.length} (last ${last.sha} ${last.date})` : '';
}

export function stampLanded(text, sha, subject) {
  if (sha.length < MIN_SHA || entries(text).some((e) => same(e.sha, sha))) return null;
  const clipped = String(subject).replace(/\s+/g, ' ').trim().slice(0, SUBJECT_MAX);
  return appendUnderSection(text, 'History', `- [${stamp()}] (landed) ${sha} ${clipped}`);
}

export function remainingNote(id, state, text, remaining) {
  if (state !== 'todo') return '';
  const n = entries(text).length;
  if (!n) return '';
  if (!remaining || !remaining.trim()) {
    throw new Error(`${id}: ${n} landed commit(s) are recorded in its History — say what is left: re-run with --remaining "<what is still to build>"`);
  }
  return `remaining after ${n} landed commit(s): ${remaining.trim()}`;
}

export function builtButUnticked(root) {
  const dir = join(root, '.ai', 'tickets');
  const out = [];
  let names = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    if (!n.endsWith('.md') || n === 'INDEX.md' || n.startsWith('_')) continue;
    let text;
    try { text = readFileSync(join(dir, n), 'utf8'); } catch { continue; }
    const parts = splitFrontmatter(text);
    const status = parts && field(parts.fm, 'status');
    const count = entries(text).length;
    if (OPEN_STATES.has(status) && count) out.push({ id: field(parts.fm, 'id'), title: field(parts.fm, 'title') || '', status, count });
  }
  return out;
}
