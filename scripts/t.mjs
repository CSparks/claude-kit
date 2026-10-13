#!/usr/bin/env node
// t.mjs — the ONE tool for STRUCTURED mutations of the .ai store (KIT-T075 / KIT-D032).
//
// Every store-integrity failure in the review was a hand-edit failure: stale `doing`, INDEX
// drift, template placeholder text shipped in supersede fields, self-asserted statuses. This
// CLI centralizes the invariants — markdown files stay the durable truth, but the STRUCTURED
// parts (status, criterion ticks, typed links, scaffolding a new ticket) flow through one
// tool that validates, stamps history, regenerates the indexes, and ingests the cache in the
// SAME invocation. PROSE sections (Description / Notes body) stay direct-edit (Edit) — the
// boundary is "enforce structure with a tool, never lock the prose".
//
//   t new <type> "<title>" [--priority <p>] [--not-dup <id,...>] [--root <dir>]   scaffold a ticket (id minted,
//                                                   never picked); refuses when an open ticket looks like the
//                                                   same work (t-dedup.mjs) unless --not-dup names the items checked
//   t status <id> <state> [--human] [--note "…"] [--fixed-commit <sha>] [--no-trail-check "<reason>"] [--remaining "…"]
//                                                   (todo on a ticket with landed commits needs --remaining)
//   t tick <id> <ordinal|substring> [--note "…"]   check an acceptance box
//   t untick <id> <ordinal|substring>               uncheck one (ordinal counts CHECKED boxes)
//   t criterion <id> "<text>"                       append an acceptance criterion
//   t link <id> <rel> <target>                      supersedes|superseded_by|regressed_from|
//                                                   causing_commit|fixed_commit|parent|link
//   t move <id> <repo-path>                         promote an item into an adopted repo's .ai/
//
// IDs are NEVER hand-picked — `t new` mints via id-utils.nextId (KIT-D011). Every subcommand
// fails loudly on an unknown id rather than inventing one. After a mutation the CLI refreshes
// the derived board (index-tickets, which also reconciles supersede edges) and ingests the
// SQLite cache — both fail-open, so a missing engine never wedges a mutation.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nextId, readIdConfig, idExists, fileForId } from './id-utils.mjs';
import { splitFrontmatter, field } from './frontmatter.mjs';
import { buildComment, parseComments, recordAck } from './comments.mjs';
import { resolveUser } from './identity.mjs';
import { appendUnderSection, stamp } from './md-body.mjs';
import { addCriterion, setCriterionAt, tickCriterion, untickCriterion } from './criteria.mjs';
import { wantsHelp } from './cli-help.mjs';
import { readProvenanceGate, trailGate } from './provenance.mjs';
import { resolveStoreRoot, refuseIfExcluded } from '../hooks/lib.mjs';
import { readConfig } from './t-config.mjs';
import { findDuplicates, refusal } from './t-dedup.mjs';
import { SHA_RE, findTicket, setField } from './t/ticket-file.mjs';
import { setStatus } from './t/status.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ID_RE = /^[A-Za-z][A-Za-z0-9]*-[A-Za-z]?\d+$/; // KIT-T075, KIT-D032 (keys may carry digits: S2-T001)

// A typed-link relation either points at another ITEM (id-shaped) or a COMMIT (sha-shaped).
// Anything else is rejected — `t link` never writes a free-text edge.
const LINK_RELS = {
  supersedes: 'id',
  superseded_by: 'id',
  regressed_from: 'id',
  parent: 'id',
  link: 'id',
  causing_commit: 'sha',
  fixed_commit: 'sha',
};

// --- frontmatter WRITERS (the readers come from frontmatter.mjs — KIT-T110) -----------------
// The local reader copies this file carried were LF-only: a ticket whose delimiters end CRLF
// (any Windows editor, any autocrlf checkout) matched nothing, so every mutation died with
// "no frontmatter block to update" while the block looked perfectly valid on inspection.
function addToList(fm, key, value) {
  const re = new RegExp(`^(${key}:)[ \\t]*(.*)$`, 'm');
  const m = fm.match(re);
  if (!m) return `${fm}\n${key}: [${value}]`;
  const cur = m[2].trim().replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  if (cur.includes(value)) return fm;
  cur.push(value);
  return fm.replace(re, `$1 [${cur.join(', ')}]`);
}

export { readConfig, findTicket, setStatus };

// --- t new ---------------------------------------------------------------------------------

// Scaffold a ticket: mint the id (next-id owns minting), filename = id, complete VALID
// frontmatter + the section skeleton. The prose body stays a placeholder the author fills via
// Edit — this kills the T039-T043 class where a hand-copied template shipped with KIT-T000 and
// `<short imperative title>` still in the fields.
// The Notes section recording which near-matches `t new --not-dup` was told are different work.
function notDupNotes(ids) {
  return ids && ids.length ? `\n## Notes\nChecked as possible duplicates and judged different work (--not-dup): ${ids.join(', ')}\n` : '';
}

export function scaffoldNew(root, type, title, opts = {}) {
  const { classifications, ticketTypes, routes, priorities, classPriority } = readConfig(root);
  if (!type) throw new Error('t new: a <type> is required');
  if (classifications.length && !classifications.includes(type)) {
    throw new Error(`t new: unknown type '${type}' (config.classifications: ${classifications.join(', ')})`);
  }
  // A classification routed to another store is NOT a ticket type. `t new decision` used to mint a
  // TICKET id and write it to tickets/ with `type: decision` — the item then lived on the board
  // with a T id while the decisions store never heard of it, and the D counter kept its old max.
  if (ticketTypes.length && !ticketTypes.includes(type)) {
    throw new Error(`t new: '${type}' is not a ticket type — config.classifications routes it to ` +
      `'${routes[type]}', not the ticket board. Ticket types: ${ticketTypes.join(', ')}. ` +
      `To file this one: cap ${type} "…", and triage routes it to ${routes[type]}.`);
  }
  if (!title || !title.trim()) throw new Error('t new: a non-empty "<title>" is required');
  if (/[\n\r]/.test(title)) throw new Error('t new: a title is a single line — put the detail in the Description');
  // A caller with more than a title (the web form) seeds priority + Description here rather than
  // rewriting the file afterwards: the scaffold shape has exactly one owner.
  // Absent an explicit --priority, the type's own `classifications.<type>.priority` decides
  // (KIT-T141) — a bug scaffolded `medium` in a project whose config calls every bug `high`.
  const priority = opts.priority ? String(opts.priority).trim() : (classPriority[type] || 'medium');
  if (!priorities.includes(priority)) {
    throw new Error(`t new: unknown priority '${priority}' (config.priorities: ${priorities.join(', ')})`);
  }
  const description = String(opts.description ?? '').trim() || '<!-- what and why — fill in via Edit -->';
  const id = nextId(root, 'tickets');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'ticket';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const path = join(root, '.ai', 'tickets', `${id}-${slug}.md`);
  if (existsSync(path)) throw new Error(`t new: ${path} already exists`);
  // The slug varies per title, so the path check above misses a same-id/different-slug
  // collision — the shape that put five duplicate-id tickets on gridiron's board (KIT-T166).
  const aiDir = join(root, '.ai');
  if (idExists(aiDir, id)) {
    throw new Error(`t new: refusing to create '${id}' — that id already exists (${fileForId(aiDir, id)})`);
  }
  const doc = `---
id: ${id}
title: ${title.trim()}
type: ${type}
status: todo
priority: ${priority}
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: ${now}
updated: ${now}
---

## Description
${description}

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.
${notDupNotes(opts.notDup)}
## History
- [${stamp()}] (created) ${type} — ${title.trim()}
`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, doc);
  return { id, path };
}

// --- t tick / t untick / t criterion --------------------------------------------------------

// criteria.mjs owns WHICH line a selector means and the History stamp; this layer owns locating
// the ticket and writing the transformed body back — so the CLI and the web API mutate criteria
// through the same invariants (KIT-T153).
function mutateCriteria(root, id, transform) {
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);
  const { body, criterion } = transform(t.parts.rest);
  writeFileSync(t.path, t.parts.open + t.parts.fm + t.parts.close + body);
  return { id, criterion, path: t.path };
}

// `selector` is a 1-based ordinal among the criteria eligible for the act (open ones for a tick,
// checked ones for an untick), or a substring that must match exactly one of them.
export const tick = (root, id, selector, opts = {}) =>
  mutateCriteria(root, id, (body) => tickCriterion(body, selector, { ...opts, id }));

export const untick = (root, id, selector, opts = {}) =>
  mutateCriteria(root, id, (body) => untickCriterion(body, selector, { ...opts, id }));

// Index-addressed toggle for clients that render the criterion list (the web UI) instead of
// counting open boxes.
export const setCriterion = (root, id, index, checked, opts = {}) =>
  mutateCriteria(root, id, (body) => setCriterionAt(body, index, checked, { ...opts, id }));

export const addCriterionTo = (root, id, text, opts = {}) =>
  mutateCriteria(root, id, (body) => addCriterion(body, text, { ...opts, id }));

// --- t link --------------------------------------------------------------------------------

// Write a TYPED link, shape-validated. `supersedes` is reciprocal: it writes the back-pointer
// AND flips the retired ticket to status: superseded on BOTH files, so the relationship is
// never left half-declared (the failure that shipped placeholder text in supersede fields).
export function link(root, id, rel, target) {
  const kind = LINK_RELS[rel];
  if (!kind) throw new Error(`t link: unknown rel '${rel}' (one of: ${Object.keys(LINK_RELS).join(', ')})`);
  if (kind === 'id' && !ID_RE.test(target)) throw new Error(`t link: '${target}' is not an id-shaped target for ${rel}`);
  if (kind === 'sha' && !SHA_RE.test(target)) throw new Error(`t link: '${target}' is not a sha for ${rel}`);

  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);

  if (rel === 'link') {
    const fm = addToList(t.parts.fm, 'links', target);
    writeFileSync(t.path, t.parts.open + fm + t.parts.close + t.parts.rest);
    return { id, rel, target };
  }

  if (rel === 'supersedes' || rel === 'superseded_by') {
    // Normalize to (newer supersedes older) regardless of which side was named.
    const newer = rel === 'supersedes' ? id : target;
    const older = rel === 'supersedes' ? target : id;
    const nt = findTicket(root, newer);
    const ot = findTicket(root, older);
    const nfm = setField(nt.parts.fm, 'supersedes', older);
    writeFileSync(nt.path, nt.parts.open + nfm + nt.parts.close + nt.parts.rest);
    let ofm = setField(ot.parts.fm, 'superseded_by', newer);
    ofm = setField(ofm, 'status', 'superseded');
    const obody = appendUnderSection(ot.parts.rest, 'History', `- [${stamp()}] (status) → superseded (by ${newer})`);
    writeFileSync(ot.path, ot.parts.open + ofm + ot.parts.close + obody);
    return { id, rel, target, newer, older, bothSides: true };
  }

  // single-sided provenance scalar (regressed_from / causing_commit / fixed_commit / parent)
  const fm = setField(t.parts.fm, rel, target);
  writeFileSync(t.path, t.parts.open + fm + t.parts.close + t.parts.rest);
  return { id, rel, target };
}

// --- t comment ----------------------------------------------------------------------------

// Append a durable authored comment as a History `(comment)` event. Multi-line / long prose
// spills to ## Notes with the History line referencing it (comments.buildComment owns the
// shape). @mentions are DERIVED on read, never stored. Pure markdown mutation; the CLI main
// wraps this with the index/cache refresh (comment activity lands in the cache history table).
export function comment(root, id, text, opts = {}) {
  const author = (opts.author || '').trim();
  if (!author) throw new Error('t comment: --author <who> is required');
  if (text === undefined || !String(text).trim()) throw new Error('t comment: a non-empty "<text>" is required');
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);
  const built = buildComment(t.parts.rest, { id, author, text, ts: stamp() });
  let body = appendUnderSection(t.parts.rest, 'History', built.historyLine);
  if (built.notesBlock) body = appendUnderSection(body, 'Notes', built.notesBlock);
  writeFileSync(t.path, t.parts.open + t.parts.fm + t.parts.close + body);
  return { id, ref: built.ref, ordinal: built.ordinal, mentions: built.mentions, spilled: !!built.notesBlock, path: t.path };
}

// --- t ack --------------------------------------------------------------------------------

// Record a per-agent read receipt for one comment. The reference is `<id>#<ordinal>` — the
// ticket id plus the comment's 1-based ordinal (append-only, so unambiguous). Verifies the
// comment exists before writing the receipt; acked mentions stop surfacing at orient/drain.
export function ack(root, refToken, opts = {}) {
  const agent = (opts.agent || '').trim();
  if (!agent) throw new Error('t ack: --agent <name> is required');
  const m = String(refToken || '').match(/^([A-Za-z]+-[A-Za-z]?\d+)#(\d+)$/);
  if (!m) throw new Error(`t ack: reference must be <id>#<comment-ordinal> (e.g. KIT-T130#2), got '${refToken}'`);
  const id = m[1];
  const ordinal = parseInt(m[2], 10);
  const t = findTicket(root, id);
  const comments = parseComments(t.parts ? t.parts.rest : t.text);
  const target = comments.find((c) => c.ordinal === ordinal);
  if (!target) throw new Error(`${id}: no comment #${ordinal} (ticket carries ${comments.length} comment(s))`);
  const rec = recordAck(root, { ref: `${id}#${ordinal}`, agent, ts: target.tsKey });
  return { id, ref: rec.ref, agent: rec.agent, already: rec.already, mentions: target.mentions };
}

// --- write-time structure lint (shared with hooks/ingest-data.mjs) -------------------------

const PLACEHOLDERS = [
  /id:\s*[A-Za-z]+-[A-Za-z]?0+\b/, // the template sentinel id (KIT-T000)
  /title:\s*<[^>]+>/, // <short imperative title>
  /<YYYY-MM-DD/, // unfilled timestamp placeholder
];

// Surface STRUCTURAL problems on a store file — named, never blocking. Returns a list of
// human-readable warnings (empty = clean). The hook fails open: it emits these to stderr and
// always exits 0, so a malformed file is flagged but the write still lands (suspenders to the
// CLI's belt). Prose is never judged here — only the frontmatter envelope + leftover template.
export function lintStoreText(text, relpath = '') {
  const warns = [];
  const needsFm = /(^|[\\/])(tickets|decisions)[\\/]/.test(relpath) || relpath === '';
  const parts = splitFrontmatter(text);
  if (!parts) {
    if (needsFm && /^---/.test(text)) warns.push('frontmatter: opening `---` without a closing `---` (malformed block)');
    return warns;
  }
  if (!field(parts.fm, 'id')) warns.push('frontmatter: missing `id:`');
  const status = field(parts.fm, 'status');
  if (parts.fm.match(/^status:/m) && !status) warns.push('frontmatter: empty `status:`');
  for (const re of PLACEHOLDERS) {
    if (re.test(parts.fm)) { warns.push('frontmatter: unfilled template placeholder still present (run `t new`, do not copy the template by hand)'); break; }
  }
  return warns;
}

// --- evidence floor (shared with commit-gate + ingest-data; KIT-T061) ----------------------

// The explicit, documented non-evidence path — same philosophy as the commit gate's [no-log:].
export const NO_TEST_ESCAPE = /\[no-test:\s*[^\]]+\]/i;

// What COUNTS as test evidence in a ticket's Notes/History (or a frontmatter fixed_commit):
// a test file path, a suite-run reference, or a commit sha. Deliberately broad — the floor is a
// floor, and over-strictness causes false blocks; the explicit [no-test:] escape is the relief
// valve, not a tight evidence grammar.
export const EVIDENCE_PATTERNS = [
  /\b[\w./-]+\.(?:test|spec)\.[a-z]+\b/i,        // scripts/foo.test.mjs, app.spec.ts
  /\btests?[\\/][\w./-]+/i,                        // a test/ or tests/ path
  /\b(?:npm|pnpm|yarn)\s+test\b/i,                // suite-run reference
  /\bnode\s+--test\b/i,
  /\b(?:pytest|go\s+test|cargo\s+test|jest|vitest|mocha)\b/i,
  /\b\d+\s+(?:pass(?:ed|ing)|tests? pass)/i,      // "43 passed", "5 passing"
  /\bsuite green\b/i,
  /\b[0-9a-f]{7,40}\b/,                            // a test/fixing commit sha
];

// Resolve whether a ticket file's text sits at its CLOSING transition for the project's uat
// resolution (KIT-D034) and whether it carries the required evidence. PURE — the commit-gate
// (blocker) and ingest-data (advisory) decide what to DO with `needsEvidence`. The closing
// transition is doing→review where uat resolves `required`, doing→done where `none`; a
// per-ticket `uat:` frontmatter field overrides the project default.
export function evidenceFloor(text, uatDefault = 'required') {
  const parts = splitFrontmatter(text);
  const status = parts ? field(parts.fm, 'status') : '';
  const uat = (parts && field(parts.fm, 'uat')) || uatDefault;
  const closing = uat === 'required' ? 'review' : 'done';
  const atClosing = status === closing;
  const hasEvidence = EVIDENCE_PATTERNS.some((re) => re.test(text));
  const hasEscape = NO_TEST_ESCAPE.test(text);
  return { status, closing, atClosing, hasEvidence, hasEscape, needsEvidence: atClosing && !hasEvidence && !hasEscape };
}

// --- refresh (CLI-only side effect) --------------------------------------------------------

// Regenerate the derived board + ingest the cache after a mutation, BOTH fail-open. index-tickets
// also runs the supersede reconcile/dedup pass, so a one-sided edge is made consistent here.
// The ticket-start trail check. Fail-open on a query error: a missing cache/engine must never
// stop a status transition — the trail is guidance, the markdown is the truth.
export async function startTrail(root, id, escape = '') {
  let trail = [];
  try {
    const { query } = await import('./q-lib.mjs');
    const { rows } = await query('trail', [id], { cwdRoot: root });
    trail = Array.isArray(rows) ? rows : [];
  } catch {
    return { level: 'ok', lines: ['  (trail unavailable — no cache and no scan)'], message: '' };
  }
  return trailGate({ id, trail, gate: readProvenanceGate(root), escape });
}

async function refresh(root) {
  try {
    execFileSync('node', [join(SCRIPT_DIR, 'index-tickets.mjs'), root], { stdio: 'ignore', windowsHide: true });
  } catch { /* board regen is best-effort; the markdown is already the truth */ }
  try {
    const { hydrate, defaultDbPath } = await import('./hydrate-db.mjs');
    await hydrate({ root, dbPath: defaultDbPath() });
  } catch { /* the cache is derived + optional — never a hard dependency */ }
}

// --- CLI -----------------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--human') flags.human = true;
    else if (a === '--note') flags.note = argv[++i];
    else if (a === '--fixed-commit') flags.fixedCommit = argv[++i];
    else if (a === '--remaining') flags.remaining = argv[++i];
    else if (a === '--priority') flags.priority = argv[++i];
    else if (a === '--author') flags.author = argv[++i];
    else if (a === '--agent') flags.agent = argv[++i];
    else if (a === '--root') flags.root = argv[++i];
    else if (a === '--not-dup') flags.notDup = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--no-trail-check') flags.noTrailCheck = argv[++i] || '(no reason given)';
    else pos.push(a);
  }
  return { flags, pos };
}

async function main() {
  refuseIfExcluded('t');
  const { flags, pos } = parseArgs(process.argv.slice(2));
  // ONE resolution rule (KIT-T189): an explicit --root, else the nearest store above the cwd,
  // else the unbounded catch-all. The cwd stays the last resort so an uninitialized machine
  // still errors the way it always did.
  const root = flags.root || resolveStoreRoot(process.cwd()) || process.cwd();
  const [cmd, ...rest] = pos;
  const usage = 'usage: t <new|status|tick|untick|criterion|link|comment|ack|asked|move> …  (t new <type> "<title>" | t status <id> <state> [--human] | t tick <id> <ordinal|match> | t untick <id> <ordinal|match> | t criterion <id> "<text>" | t link <id> <rel> <target> | t comment <id> "<text>" --author <who> | t ack <id>#<n> --agent <name> | t asked <id> [--note <capture>] | t move <id> <repo-path>)';

  if (wantsHelp(process.argv.slice(2))) { process.stdout.write(usage + '\n'); return; }
  if (!cmd) { console.error(usage); process.exit(2); }

  if (cmd === 'new') {
    const [type, ...titleWords] = rest;
    const title = titleWords.join(' ');
    if (!flags.notDup?.length && title.trim()) {
      const hits = await findDuplicates(root, title);
      if (hits.length) { console.error(refusal(title, hits)); process.exit(1); }
    }
    const { id, path } = scaffoldNew(root, type, title, flags);
    await refresh(root);
    process.stdout.write(`new: ${id} -> ${path.replace(resolve(root) + '/', '').replace(resolve(root) + '\\', '')}\n`);
    return;
  }
  if (cmd === 'status') {
    const [id, state] = rest;
    if (!id || !state) { console.error('usage: t status <id> <state> [--human] [--note "…"] [--fixed-commit <sha>]'); process.exit(2); }
    // Trail-on-action (KIT-D028 / KIT-T048): starting work surfaces where the item CAME FROM,
    // and an item pointing at nothing upstream is called out. Warn by default, block only
    // where the project opts in (config `provenance.gate: block`).
    if (state === 'doing') {
      const verdict = await startTrail(root, id, flags.noTrailCheck);
      process.stdout.write(`trail: ${id}\n` + verdict.lines.join('\n') + '\n');
      if (verdict.level === 'block') { process.stderr.write('t: ' + verdict.message + '\n'); process.exit(1); }
      if (verdict.message) process.stderr.write('  ⚠ ' + verdict.message + '\n');
    }
    const r = setStatus(root, id, state, flags);
    await refresh(root);
    process.stdout.write(`status: ${r.id} ${r.from} → ${r.to}${r.archived ? ' (archived)' : ''}\n`);
    for (const w of r.warnings) process.stderr.write(`  ⚠ ${w}\n`);
    return;
  }
  if (cmd === 'tick' || cmd === 'untick') {
    const [id, selector] = rest;
    if (!id || selector === undefined) { console.error(`usage: t ${cmd} <id> <ordinal|substring> [--note "…"]`); process.exit(2); }
    const r = (cmd === 'tick' ? tick : untick)(root, id, selector, flags);
    await refresh(root);
    process.stdout.write(`${cmd}: ${r.id} ${cmd === 'tick' ? '✓' : '↺'} ${r.criterion}\n`);
    return;
  }
  if (cmd === 'criterion') {
    const [id, ...textWords] = rest;
    const text = textWords.join(' ');
    if (!id || !text.trim()) { console.error('usage: t criterion <id> "<text>"'); process.exit(2); }
    const r = addCriterionTo(root, id, text, flags);
    await refresh(root);
    process.stdout.write(`criterion: ${r.id} + ${r.criterion}\n`);
    return;
  }
  if (cmd === 'link') {
    const [id, rel, target] = rest;
    if (!id || !rel || !target) { console.error('usage: t link <id> <rel> <target>'); process.exit(2); }
    const r = link(root, id, rel, target);
    await refresh(root);
    process.stdout.write(`link: ${r.id} ${r.rel} ${r.target}${r.bothSides ? ` (+ ${r.older}.superseded_by = ${r.newer})` : ''}\n`);
    return;
  }
  if (cmd === 'comment') {
    const [id, ...textWords] = rest;
    const text = textWords.join(' ');
    if (!id || !text.trim()) { console.error('usage: t comment <id> "<text>" [--author <who>]'); process.exit(2); }
    // A human running `t comment` without --author defaults to their resolved alias (KIT-T145),
    // the same identity /api/me reports; an agent still passes --author (or KIT_AGENT-derived) explicitly.
    const author = flags.author || resolveUser();
    const r = comment(root, id, text, { ...flags, author });
    await refresh(root);
    const mentioned = r.mentions.length ? ` — mentions ${r.mentions.map((m) => '@' + m).join(' ')}` : '';
    process.stdout.write(`comment: ${r.ref} by @${author}${r.spilled ? ' (body → Notes)' : ''}${mentioned}\n`);
    return;
  }
  if (cmd === 'asked') {
    const [id] = rest;
    if (!id) { console.error('usage: t asked <id> [--note <capture file or text>]'); process.exit(2); }
    const found = findTicket(root, id);
    if (!found) { console.error(`t asked: no ticket ${id}`); process.exit(2); }
    const { bumpAsked } = await import('./asked-again.mjs');
    const r = bumpAsked(found.path, flags.note || 'asked again', readConfig(root).priorities);
    await refresh(root);
    process.stdout.write(`asked: ${r.id} asked ${r.asked}x, priority ${r.from} -> ${r.to}
`);
    return;
  }
  if (cmd === 'move') {
    const [id, destPath] = rest;
    if (!id || !destPath) { console.error('usage: t move <id> <repo-path>'); process.exit(2); }
    const { moveItem } = await import('./t-move.mjs');
    const r = await moveItem(root, id, destPath);
    await refresh(root);
    await refresh(r.destRoot);
    process.stdout.write(`move: ${r.from} → ${r.to} in ${r.destRoot} (pointer left at ${r.pointer})\n`);
    return;
  }
  if (cmd === 'ack') {
    const [refToken] = rest;
    if (!refToken) { console.error('usage: t ack <id>#<comment-ordinal> --agent <name>'); process.exit(2); }
    const r = ack(root, refToken, flags);
    process.stdout.write(`ack: ${r.ref} by ${r.agent}${r.already ? ' (already acked)' : ''}\n`);
    return;
  }
  console.error(`t: unknown subcommand '${cmd}'\n${usage}`);
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write('t: ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
  });
}
