#!/usr/bin/env node
// Tests for t.mjs — the structured .ai store mutation CLI (KIT-T075). Builds throwaway .ai
// fixtures in a temp dir and drives the EXPORTED mutation functions directly (no index/cache
// refresh — that side effect is CLI-only). One integration case shells the real CLI to prove
// the refresh wiring regenerates the board. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  scaffoldNew, setStatus, tick, untick, setCriterion, addCriterionTo, link, lintStoreText,
  readConfig, findTicket, evidenceFloor, comment,
} from './t.mjs';
import { listCriteria } from './criteria.mjs';

const SCRIPT = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, '.mjs');
let pass = 0;
let fail = 0;
const fixtures = [];

// KIT-T142: the CLI's refresh wiring hydrates into defaultDbPath(), which resolves under
// CLAUDE_PLUGIN_ROOT. A fixture config declaring a REAL project key would otherwise sync a
// throwaway temp root into the live cache under that scope — replacing it, not adding to it.
const PLUGIN_ROOT = mkdtempSync(join(tmpdir(), 'kit-t-plugin-'));
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT;
fixtures.push(PLUGIN_ROOT);
// KIT-T164 pairs with that redirect: only a REGISTERED store may hydrate into a shared cache, so
// a fixture must be named in a throwaway registry to reach even the sandboxed one — and the real
// registry (with its real project paths) stays out of the run entirely.
const REGISTRY = join(PLUGIN_ROOT, 'projects.json');
writeFileSync(REGISTRY, JSON.stringify({ projects: {} }, null, 2));
process.env.CLAUDE_KIT_REGISTRY = REGISTRY;
const CHILD_ENV = { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, CLAUDE_KIT_REGISTRY: REGISTRY };
function registerFixture(name, root) {
  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  reg.projects[name] = root;
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));
}
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}
function threw(fn) {
  try { fn(); return false; } catch { return true; }
}
// The message matters when a refusal has to tell the caller WHERE the item belongs (KIT-T185).
function threwWith(fn) {
  try { fn(); return ''; } catch (e) { return e.message; }
}

const CONFIG = ({ humanOnly = '[]', uatDefault = 'required' }) => `classifications:
  feature: { routes_to: backlog }
  bug:     { routes_to: tickets }
  question: { routes_to: questions }
statuses:
  flow: [todo, doing, review, done]
  human_only: ${humanOnly}
  off_board: [superseded]
uat:
  default: ${uatDefault}
history:
  archive_done_to: tickets/archive
ids:
  key: "KIT"
  prefix: "KIT-T"
  pad: 3
`;

function ticketDoc(id, { type = 'feature', status = 'todo', uat = '', extra = '' } = {}) {
  return `---
id: ${id}
title: seed ${id}
type: ${type}
status: ${status}
priority: high
${uat ? `uat: ${uat}\n` : ''}links: []
supersedes:
superseded_by:
---

## Description
seed.

## Acceptance Criteria
- [ ] first criterion
- [ ] second criterion done quickly
${extra ? `\n${extra}\n` : ''}
## History
`;
}

// A fixture project: config (with overridable gates) + seeded tickets.
function project(cfgOpts = {}, tickets = {}) {
  const d = mkdtempSync(join(tmpdir(), 'kit-t-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), CONFIG(cfgOpts));
  for (const [id, opts] of Object.entries(tickets)) {
    writeFileSync(join(d, '.ai', 'tickets', `${id}-seed.md`), ticketDoc(id, opts));
  }
  return d;
}

// --- readConfig parses the taxonomy ---
const cfgRoot = project({ humanOnly: '[done]', uatDefault: 'none' });
const cfg = readConfig(cfgRoot);
ok('readConfig: flow', JSON.stringify(cfg.flow) === JSON.stringify(['todo', 'doing', 'review', 'done']));
ok('readConfig: human_only', JSON.stringify(cfg.humanOnly) === JSON.stringify(['done']));
ok('readConfig: off_board', cfg.offBoard.includes('superseded'));
ok('readConfig: uat default', cfg.uatDefault === 'none');
ok('readConfig: classifications', cfg.classifications.includes('feature') && cfg.classifications.includes('bug'));

// --- valid + invalid transitions ---
const tr = project({ uatDefault: 'required' }, { 'KIT-T001': {} });
const moved = setStatus(tr, 'KIT-T001', 'doing');
ok('status: todo → doing succeeds', moved.from === 'todo' && moved.to === 'doing');
ok('status: frontmatter updated', /status: doing/.test(readFileSync(moved.path, 'utf8')));
ok('status: History line appended', /\(status\) todo → doing/.test(readFileSync(moved.path, 'utf8')));
ok('status: rejects unknown state', threw(() => setStatus(tr, 'KIT-T001', 'bogus')));
ok('status: rejects unknown id', threw(() => setStatus(tr, 'KIT-T999', 'doing')));

// --- human_only refusal ---
const ho = project({ humanOnly: '[done]', uatDefault: 'none' }, { 'KIT-T010': {} });
ok('status: human_only state refused without --human', threw(() => setStatus(ho, 'KIT-T010', 'done')));
ok('status: human_only state allowed with --human', setStatus(ho, 'KIT-T010', 'done', { human: true }).to === 'done');

// --- uat gate: required refuses agent; none is agent-callable; per-ticket override wins ---
const uat = project({ uatDefault: 'required' }, {
  'KIT-T020': {},                 // inherits required
  'KIT-T021': { uat: 'none' },    // override → agent-callable
});
ok('status: done refused when uat=required (no --human)', threw(() => setStatus(uat, 'KIT-T020', 'done')));
ok('status: done allowed when uat=required WITH --human', setStatus(uat, 'KIT-T020', 'done', { human: true }).to === 'done');
ok('status: done agent-callable when uat=none override', setStatus(uat, 'KIT-T021', 'done').to === 'done');

// --- done tail: archive + fixed_commit hygiene ---
const dt = project({ uatDefault: 'none' }, {
  'KIT-T030': { type: 'feature' },
  'KIT-T031': { type: 'bug' },
  'KIT-T032': { type: 'bug' },
});
const arch = setStatus(dt, 'KIT-T030', 'done');
ok('done tail: file archived to tickets/archive/', arch.archived && /tickets[\\/]archive[\\/]/.test(arch.path) && existsSync(arch.path));
ok('done tail: original path no longer present', !existsSync(join(dt, '.ai', 'tickets', 'KIT-T030-seed.md')));
const bugWarn = setStatus(dt, 'KIT-T031', 'done');
ok('done tail: bug without fixed_commit warns', bugWarn.warnings.some((w) => /fixed_commit/.test(w)));
const bugFixed = setStatus(dt, 'KIT-T032', 'done', { fixedCommit: 'a1b2c3d' });
ok('done tail: --fixed-commit written', /fixed_commit: a1b2c3d/.test(readFileSync(bugFixed.path, 'utf8')) && bugFixed.warnings.length === 0);
ok('done tail: rejects a non-sha fixed-commit', threw(() => setStatus(dt, 'KIT-T031', 'done', { fixedCommit: 'nope!' })));
// KIT-T190: the sha used to be read only inside the done+bug/regression branch, so every OTHER
// transition accepted --fixed-commit and threw it away — including `review`, the shape a
// uat=required project closes with, and any non-bug type.
const fc = project({ uatDefault: 'none' }, { 'KIT-T033': { type: 'bug' }, 'KIT-T034': { type: 'feature' } });
const onReview = setStatus(fc, 'KIT-T033', 'review', { fixedCommit: 'beef123' });
ok('fixed-commit: written on a REVIEW transition, not just done',
  /fixed_commit: beef123/.test(readFileSync(onReview.path, 'utf8')));
const onFeature = setStatus(fc, 'KIT-T034', 'doing', { fixedCommit: 'cafe456' });
ok('fixed-commit: written for a non-bug type too (an explicit flag is never dropped)',
  /fixed_commit: cafe456/.test(readFileSync(onFeature.path, 'utf8')));
ok('fixed-commit: a bad sha is rejected on any transition, not silently ignored',
  threw(() => setStatus(fc, 'KIT-T034', 'review', { fixedCommit: 'not-a-sha!' })));

// --- tick ---
const tk = project({ uatDefault: 'none' }, { 'KIT-T040': {} });
const t1 = tick(tk, 'KIT-T040', 1);
ok('tick: ordinal 1 checks the first box', /- \[x\] first criterion/.test(readFileSync(t1.path, 'utf8')));
ok('tick: leaves the second box open', /- \[ \] second criterion/.test(readFileSync(t1.path, 'utf8')));
ok('tick: stamps an auditable History line', /\(comment\) ticked: first criterion/.test(readFileSync(t1.path, 'utf8')));
ok('tick: substring match checks the right box', /- \[x\] second criterion/.test(readFileSync(tick(tk, 'KIT-T040', 'second').path, 'utf8')));
ok('tick: out-of-range ordinal throws', threw(() => tick(project({}, { 'KIT-T041': {} }), 'KIT-T041', 9)));
ok('tick: no open criteria left throws', threw(() => tick(tk, 'KIT-T040', 1)));

// --- untick (KIT-T153): the maintainer can undo a tick, and the undo is itself audited ---
const un = project({ uatDefault: 'none' }, { 'KIT-T042': {} });
tick(un, 'KIT-T042', 'first');
const u1 = untick(un, 'KIT-T042', 'first');
ok('untick: reopens the box', /- \[ \] first criterion/.test(readFileSync(u1.path, 'utf8')));
ok('untick: stamps its own History line', /\(comment\) unticked: first criterion/.test(readFileSync(u1.path, 'utf8')));
ok('untick: ordinal counts CHECKED criteria only', threw(() => untick(un, 'KIT-T042', 1)));
ok('untick: ambiguous substring throws', threw(() => {
  const amb = project({}, { 'KIT-T043': {} });
  tick(amb, 'KIT-T043', 1);
  tick(amb, 'KIT-T043', 1);
  untick(amb, 'KIT-T043', 'criterion');
}));

// --- setCriterion: index-addressed toggle (the API path — indexes ALL criteria, not open ones) ---
const ix = project({ uatDefault: 'none' }, { 'KIT-T044': {} });
ok('setCriterion: index 1 checks the second criterion', /- \[x\] second criterion/.test(readFileSync(setCriterion(ix, 'KIT-T044', 1, true).path, 'utf8')));
ok('setCriterion: index 0 still addresses the first (unshifted by the tick)', /- \[x\] first criterion/.test(readFileSync(setCriterion(ix, 'KIT-T044', 0, true).path, 'utf8')));
ok('setCriterion: unchecking round-trips', /- \[ \] second criterion/.test(readFileSync(setCriterion(ix, 'KIT-T044', 1, false).path, 'utf8')));
ok('setCriterion: a no-op flip is refused (stale client)', threw(() => setCriterion(ix, 'KIT-T044', 0, true)));
ok('setCriterion: an out-of-range index is refused', threw(() => setCriterion(ix, 'KIT-T044', 9, true)));

// --- criteria are scoped to their own section: a checkbox under Plan is NOT a criterion ---
const sc = project({ uatDefault: 'none' }, { 'KIT-T045': { extra: '## Plan\n- [ ] not a criterion' } });
ok('scope: listCriteria sees only the AC section', listCriteria(readFileSync(findTicket(sc, 'KIT-T045').path, 'utf8')).length === 2);
tick(sc, 'KIT-T045', 1);
tick(sc, 'KIT-T045', 1);
ok('scope: a Plan checkbox is never ticked', /- \[ \] not a criterion/.test(readFileSync(findTicket(sc, 'KIT-T045').path, 'utf8')));

// --- addCriterionTo: append, fill the scaffold placeholder, reject junk ---
const ac = project({ uatDefault: 'none' }, { 'KIT-T046': {} });
const added = addCriterionTo(ac, 'KIT-T046', '  a third criterion  ');
ok('criterion: appended to the AC section, trimmed', /- \[ \] a third criterion/.test(readFileSync(added.path, 'utf8')));
ok('criterion: lands under Acceptance Criteria, not History', /## Acceptance Criteria[\s\S]*a third criterion[\s\S]*## History/.test(readFileSync(added.path, 'utf8')));
ok('criterion: stamps a History line', /\(comment\) criterion added: a third criterion/.test(readFileSync(added.path, 'utf8')));
ok('criterion: rejects empty text', threw(() => addCriterionTo(ac, 'KIT-T046', '   ')));
ok('criterion: rejects a multi-line criterion', threw(() => addCriterionTo(ac, 'KIT-T046', 'line one\nline two')));
const seeded = scaffoldNew(project({ uatDefault: 'none' }, {}), 'feature', 'Fresh ticket');
const seededRoot = seeded.path.replace(/[\\/]\.ai[\\/]tickets[\\/].*$/, '');
addCriterionTo(seededRoot, seeded.id, 'the first real criterion');
const seededText = readFileSync(seeded.path, 'utf8');
ok('criterion: fills t new\'s empty placeholder instead of leaving a blank row',
  /- \[ \] the first real criterion/.test(seededText) && !/- \[ \]\s*\n/.test(seededText));

// --- t new: optional priority + description (the web form's fields) ---
const np = project({ uatDefault: 'none' }, {});
const withOpts = scaffoldNew(np, 'feature', 'Seeded from a form', { priority: 'high', description: 'why it matters' });
const withOptsText = readFileSync(withOpts.path, 'utf8');
ok('new: --priority is written', /priority: high/.test(withOptsText));
ok('new: a supplied description replaces the placeholder', /## Description\nwhy it matters/.test(withOptsText));
ok('new: rejects an unknown priority', threw(() => scaffoldNew(np, 'feature', 'x', { priority: 'urgent' })));
ok('readConfig: ticketTypes drops classifications routed to another store',
  readConfig(np).ticketTypes.join() === 'feature,bug' && readConfig(np).classifications.includes('question'));
ok('readConfig: routes records each classification\'s routes_to target',
  readConfig(np).routes.question === 'questions');
// KIT-T185: `t new decision` minted a TICKET id and filed it in tickets/ with `type: decision`
// — an item on the board under a T id while the decisions store never heard of it. A
// classification routed to another store is not a ticket type, whatever the board can render.
ok('new: REFUSES a classification routed to another store (no ticket for a decision/question)',
  threw(() => scaffoldNew(np, 'question', 'should never become a ticket')));
ok('new: the refusal names the route and the real ticket types',
  /routes it to 'questions'[\s\S]*Ticket types: feature, bug/.test(
    threwWith(() => scaffoldNew(np, 'question', 'x'))));
ok('new: an unknown type is still a DIFFERENT error than a misrouted one',
  /unknown type 'bogus'/.test(threwWith(() => scaffoldNew(np, 'bogus', 'x'))));
ok('new: rejects a multi-line title', threw(() => scaffoldNew(np, 'feature', 'line one\nline two')));

// --- link: supersedes both sides + shape validation ---
const lk = project({ uatDefault: 'none' }, { 'KIT-T050': {}, 'KIT-T051': {} });
const sup = link(lk, 'KIT-T051', 'supersedes', 'KIT-T050');
const newerText = readFileSync(findTicket(lk, 'KIT-T051').path, 'utf8');
const olderText = readFileSync(findTicket(lk, 'KIT-T050').path, 'utf8');
ok('link: supersedes set on the newer', /supersedes: KIT-T050/.test(newerText));
ok('link: superseded_by set on the older (both sides)', /superseded_by: KIT-T051/.test(olderText));
ok('link: older flipped to status superseded', /status: superseded/.test(olderText));
ok('link: rejects non-id target for an id rel', threw(() => link(lk, 'KIT-T050', 'supersedes', 'deadbeef')));
ok('link: rejects non-sha target for a commit rel', threw(() => link(lk, 'KIT-T050', 'causing_commit', 'KIT-T051')));
link(lk, 'KIT-T050', 'fixed_commit', '1234abc');
ok('link: writes a commit sha for fixed_commit', /fixed_commit: 1234abc/.test(readFileSync(findTicket(lk, 'KIT-T050').path, 'utf8')));
ok('link: rejects an unknown rel', threw(() => link(lk, 'KIT-T050', 'mentions', 'KIT-T051')));

// --- t new: scaffolds a valid, placeholder-free ticket ---
const nw = project({ uatDefault: 'none' }, { 'KIT-T001': {} });
const created = scaffoldNew(nw, 'feature', 'Add a widget toggle');
ok('new: mints the next id (max+1)', created.id === 'KIT-T002');
ok('new: filename starts with the id', existsSync(created.path) && /KIT-T002-/.test(created.path));
const createdText = readFileSync(created.path, 'utf8');
ok('new: frontmatter is complete + valid', /id: KIT-T002/.test(createdText) && /type: feature/.test(createdText) && /status: todo/.test(createdText));
ok('new: NO leftover template placeholders (lint clean)', lintStoreText(createdText, created.path).length === 0);
ok('new: rejects an unknown type', threw(() => scaffoldNew(nw, 'wat', 'x')));
ok('new: rejects an empty title', threw(() => scaffoldNew(nw, 'feature', '   ')));

// --- lintStoreText: structure warnings, fail-open ---
ok('lint: flags missing id', lintStoreText('---\ntitle: x\n---\nbody', 'tickets/x.md').some((w) => /missing `id:`/.test(w)));
ok('lint: flags the template sentinel id', lintStoreText('---\nid: KIT-T000\ntitle: x\n---\n', 'tickets/x.md').some((w) => /placeholder/.test(w)));
ok('lint: flags an angle-bracket title placeholder', lintStoreText('---\nid: KIT-T9\ntitle: <short imperative title>\n---\n', 'tickets/x.md').some((w) => /placeholder/.test(w)));
ok('lint: flags an unclosed frontmatter block', lintStoreText('---\nid: KIT-T9\ntitle: x\nbody with no close', 'tickets/x.md').some((w) => /closing/.test(w)));
ok('lint: clean on a well-formed ticket', lintStoreText(readFileSync(findTicket(tr, 'KIT-T001').path, 'utf8'), 'tickets/x.md').length === 0);

// --- evidenceFloor: the UAT evidence gate logic (KIT-T061) ---
const ef = (status, uat, notes) => evidenceFloor(`---\nid: KIT-T1\nstatus: ${status}\n${uat ? `uat: ${uat}\n` : ''}---\n## Notes\n${notes}\n`, 'none');
ok('evidenceFloor: closing (done, uat=none) without evidence needs evidence', ef('done', '', 'just finished it').needsEvidence === true);
ok('evidenceFloor: a suite-run reference satisfies the floor', ef('done', '', 'ran npm test — all green').needsEvidence === false);
ok('evidenceFloor: a test path satisfies the floor', ef('done', '', 'covered by scripts/foo.test.mjs').needsEvidence === false);
ok('evidenceFloor: the [no-test:] escape satisfies the floor', ef('done', '', '[no-test: pure doc edit]').needsEvidence === false);
ok('evidenceFloor: doing is NOT the closing state under uat=none', ef('doing', '', 'wip').atClosing === false);
ok('evidenceFloor: per-ticket uat=required override closes at review', evidenceFloor('---\nid: KIT-T1\nstatus: review\nuat: required\n---\nno tests here', 'none').needsEvidence === true);

// --- KIT-T110: the shared frontmatter parser (CRLF-tolerant + comment-aware) ---
// The live Windows trap this closes: any editor / autocrlf checkout that rewrites a ticket with
// \r\n made it PERMANENTLY unwritable through the CLI — t.mjs's local LF-only `^---\n` matched
// nothing, so every mutation died with "no frontmatter block to update" while the block looked
// perfectly valid on inspection (repro in inv4d3rs, 2026-08-03).
const crlfRoot = project({ uatDefault: 'none' }, {});
writeFileSync(join(crlfRoot, '.ai', 'tickets', 'KIT-T060-crlf.md'), ticketDoc('KIT-T060').replace(/\n/g, '\r\n'));
ok('CRLF: findTicket parses the frontmatter block instead of returning null', !!findTicket(crlfRoot, 'KIT-T060').parts);
const crlfMoved = setStatus(crlfRoot, 'KIT-T060', 'doing');
ok('CRLF: t status round-trips (was "no frontmatter block to update")', crlfMoved.from === 'todo' && crlfMoved.to === 'doing');
ok('CRLF: the new status is written to the frontmatter', /^status: doing\r?$/m.test(readFileSync(crlfMoved.path, 'utf8')));
ok('CRLF: the (status) History line is appended', /\(status\) todo → doing/.test(readFileSync(crlfMoved.path, 'utf8')));
comment(crlfRoot, 'KIT-T060', 'a note on the crlf ticket', { author: 'test' });
ok('CRLF: t comment round-trips too', /\(comment\).*crlf ticket/.test(readFileSync(crlfMoved.path, 'utf8')));
// criteria.mjs was blind to the trailing \r too — every box read as "no acceptance criteria".
const crlfTicked = readFileSync(tick(crlfRoot, 'KIT-T060', 1).path, 'utf8');
ok('CRLF: t tick round-trips', /- \[x\] first criterion/.test(crlfTicked));
ok('CRLF: the rewritten criterion keeps its \\r\\n ending', /- \[x\] first criterion\r\n/.test(crlfTicked));

// A template-derived ticket keeps the template's trailing `# …` comments. The local field() this
// file used to carry read them as part of the VALUE, so `status` was the whole comment string.
const cmtRoot = project({ uatDefault: 'none' }, {});
writeFileSync(join(cmtRoot, '.ai', 'tickets', 'KIT-T061-commented.md'),
  ticketDoc('KIT-T061').replace('status: todo', 'status: todo           # todo | doing | review | done'));
ok('comment-aware: an inline YAML comment is not part of the scalar',
  setStatus(cmtRoot, 'KIT-T061', 'doing').from === 'todo');

// --- integration: the real CLI regenerates the board (refresh wiring) ---
const cli = project({ uatDefault: 'none' }, { 'KIT-T001': {} });
registerFixture('t-cli-fixture', cli);
const liveDb = join(dirname(dirname(SCRIPT)), '.cache', 'workflow.db');
const liveBefore = existsSync(liveDb) ? statSync(liveDb).mtimeMs : null;
try {
  execFileSync('node', [SCRIPT, 'status', 'KIT-T001', 'doing', '--root', cli], { stdio: 'pipe', env: CHILD_ENV });
  const idx = readFileSync(join(cli, '.ai', 'tickets', 'INDEX.md'), 'utf8');
  ok('CLI: status regenerates INDEX.md (board) in the same invocation', /KIT-T001/.test(idx) && /doing/.test(idx));
} catch (e) {
  ok('CLI: status regenerates INDEX.md (board) in the same invocation', false);
  console.log('     ' + (e.stderr ? e.stderr.toString().split('\n')[0] : e.message));
}

// KIT-T142 regression: the fixture above declares ids.key "KIT" — the REAL project key. Before
// the CLAUDE_PLUGIN_ROOT redirect this run replaced the live KIT scope (measured openCount
// 56 → 1). Assert the refresh landed in the sandbox and never reached the session's cache.
ok('KIT-T142: CLI refresh writes the redirected cache, not the live one',
  existsSync(join(PLUGIN_ROOT, '.cache', 'workflow.db')));
ok('KIT-T142: the live session cache is untouched by the suite',
  liveBefore === null || statSync(liveDb).mtimeMs === liveBefore);

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\nt: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
