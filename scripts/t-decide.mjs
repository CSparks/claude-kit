// `t decide --file <draft.md>` — record a decision through the CLI (KIT-T481). A decision is a
// file in `.ai/decisions/`; this is the sanctioned writer, so recording one never depends on a
// hand Write of that folder. The draft is validated before an id is minted, so a bad draft burns
// no id.
//
// A draft: frontmatter with `title:` (one line) and optional `summary:`, `date:` (YYYY-MM-DD,
// default today), `supersedes:`, `source:`, `id:`; a body holding `**Decision:**` and `**Why:**`.
// A `source:` naming the maintainer also needs a `**Maintainer:**` paragraph quoting their words verbatim;
// what the assistant added goes in `**Assistant-added:**` (decision-attribution.mjs).
// The id is the store's next one (id-reserve). A draft `id:` is claimed exactly or refused (taken
// on disk, at or below the store's highest, or reserved by another creator), so a cite written
// against the draft id never points at a different decision.
//
// `--from <inbox-id,...>` names the inbox notes the decision promotes (KIT-T938): each moves to inbox/triaged/
// once the decision is written, and an unknown id refuses before an id is minted.
//
// A decision that settles a framework concern in a game store is also mirrored into the framework store as an open ticket
// (KIT-T943); the decision gains `promoted: <ticket>`.
//
// The decision also adds a dated `decided <id>: <title>` line to `.ai/SESSION.md` through `t session`'s writer (KIT-T1139).
//
// `recordDecision(root, draftText, { from })` → { id, path, cleared, mirrored?: { ticket, aiDir }, mirrorError?, sessionError? }.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock, splitFrontmatter } from './frontmatter.mjs';
import { attributionProblem } from './decision-attribution.mjs';
import { reserveId, reserveNextId } from './id-reserve.mjs';
import { maxStoreNum, readIdConfig } from './id-utils.mjs';
import { resolveInboxNotes } from '../hooks/lib/inbox-rulings.mjs';
import { moveCapToTriaged } from './triage/write-item.mjs';
import { mirrorDecision } from './framework-mirror.mjs';
import { writeSession } from './t-session.mjs';

const SLUG_MAX = 64;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = ['title', 'summary', 'date', 'supersedes', 'source'];

function parseDraft(text) {
  const fm = frontmatterBlock(text);
  const split = splitFrontmatter(text);
  if (!fm || !split) throw new Error('t decide: the draft needs a --- frontmatter block');
  const get = (k) => (field(fm, k) || '').trim();
  const draft = Object.fromEntries(KEYS.map((k) => [k, get(k)]));
  draft.id = get('id');
  draft.body = split.rest.replace(/^\r?\n/, '').trimEnd();
  if (!draft.title) throw new Error('t decide: title: is required');
  if (/[\r\n]/.test(draft.title)) throw new Error('t decide: title: is one line');
  if (!/\*\*Decision:\*\*/.test(draft.body)) throw new Error('t decide: the body needs a **Decision:** paragraph');
  if (!/\*\*Why:\*\*/.test(draft.body)) throw new Error('t decide: the body needs a **Why:** paragraph');
  if (draft.date && !DATE.test(draft.date)) throw new Error(`t decide: date '${draft.date}' is not YYYY-MM-DD`);
  const misattributed = attributionProblem(draft.source, draft.body);
  if (misattributed) throw new Error(`t decide: ${misattributed}`);
  return draft;
}

function claimExactly(root, dir, wanted) {
  const { key, pad } = readIdConfig(root);
  const num = Number((wanted.match(/-D(\d+)$/) || [])[1]);
  if (!key || !wanted.startsWith(`${key}-D`) || !Number.isInteger(num)) throw new Error(`t decide: id '${wanted}' is not a ${key}-D### id`);
  if (readdirSync(dir).some((f) => f.startsWith(`${wanted}-`) || f === `${wanted}.md`)) throw new Error(`t decide: ${wanted} already exists in ${dir}`);
  if (num <= maxStoreNum(root, 'decisions')) throw new Error(`t decide: ${wanted} is at or below the store's highest decision id; drop id: to take the next one`);
  const got = reserveId({ root, store: 'decisions', key, pad, floor: num - 1 }).id;
  if (got !== wanted) throw new Error(`t decide: ${wanted} is reserved by another creator (the next free is ${got}); drop id: or pick another`);
  return wanted;
}

// A framework-scope decision becomes an open ticket in the framework store this turn (framework-mirror.mjs); a failed
// mirror never loses the decision, it is reported.
function mirrored(root, path) {
  try {
    const hit = mirrorDecision(root, path);
    return hit ? { mirrored: { ticket: hit.ticket, aiDir: hit.aiDir } } : {};
  } catch (e) {
    return { mirrorError: e.message };
  }
}

// The decision's id and title go onto the SESSION.md anchor the way `t session` writes a note, so the anchor is never stale
// after a decision (KIT-T1139); a failed anchor write never loses the decision, it is reported.
function anchored(root, id, title) {
  try {
    writeSession(root, `decided ${id}: ${title}`);
    return {};
  } catch (e) {
    return { sessionError: e.message };
  }
}

export function recordDecision(root, text, { from = [] } = {}) {
  const draft = parseDraft(text);
  const notes = resolveInboxNotes(root, from);
  const dir = join(root, '.ai', 'decisions');
  const id = draft.id ? claimExactly(root, dir, draft.id) : reserveNextId(root, 'decisions');
  const slug = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, SLUG_MAX).replace(/-$/, '') || 'decision';
  const path = join(dir, `${id}-${slug}.md`);
  if (existsSync(path)) throw new Error(`t decide: ${path} already exists`);
  const date = draft.date || new Date().toISOString().slice(0, 10);
  const head = [`id: ${id}`, `title: ${draft.title}`, `summary: ${draft.summary}`, `date: ${date}`, `supersedes: ${draft.supersedes}`, `source: ${draft.source}`];
  writeFileSync(path, `---\n${head.join('\n')}\n---\n\n${draft.body}\n`);
  const cleared = notes.map((file) => moveCapToTriaged(join(root, '.ai'), join('inbox', file)));
  return { id, path, cleared, ...mirrored(root, path), ...anchored(root, id, draft.title) };
}
