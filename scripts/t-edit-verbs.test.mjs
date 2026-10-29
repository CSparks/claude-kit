#!/usr/bin/env node
// t-edit-verbs.test.mjs — the correction verbs that replace hand edits of the store: t session --fix/--drop,
// t revise (decisions), t triage (inbox capture -> ticket), and t new with a whole-ticket draft.
// Run: node scripts/t-edit-verbs.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { editSession } from './t-session.mjs';
import { reviseDecision } from './t-revise.mjs';
import { triageCapture } from './t-triage.mjs';
import { splitDraft } from './t-draft.mjs';
import { scaffoldNew } from './t.mjs';

const T = join(dirname(fileURLToPath(import.meta.url)), 't.mjs');
const dirs = [];
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };

function store() {
  const root = mkdtempSync(join(tmpdir(), 'kit-edit-'));
  dirs.push(root);
  for (const d of ['tickets', 'decisions', 'inbox']) mkdirSync(join(root, '.ai', d), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), 'classifications:\n  bug: { routes_to: tickets, priority: high }\n  decision: { routes_to: decisions }\nstatuses:\n  flow: [todo, doing, review, done]\nuat:\n  default: none\nids:\n  key: "ED"\n  pad: 3\n');
  return root;
}
const read = (p) => readFileSync(p, 'utf8');
const runT = (root, ...args) => spawnSync(process.execPath, [T, '--root', root, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_REFRESH_TIMEOUT_MS: '5000' } });

try {
  ok('session --fix replaces the one occurrence and keeps a backup', () => {
    const root = store();
    writeFileSync(join(root, '.ai', 'SESSION.md'), '# SESSION\n\n- [2026-10-19 10:00] cites scripts/gone.mjs as the anchor\n- [2026-10-19 10:01] other line\n');
    const r = editSession(root, { fix: ['scripts/gone.mjs', 'scripts/here.mjs'] });
    assert.match(read(r.path), /cites scripts\/here\.mjs as the anchor/);
    assert.match(read(r.backup), /scripts\/gone\.mjs/);
  });

  ok('negative: --fix refuses zero or several occurrences and leaves the file alone', () => {
    const root = store();
    const body = '# SESSION\n\n- a x\n- b x\n';
    writeFileSync(join(root, '.ai', 'SESSION.md'), body);
    assert.throws(() => editSession(root, { fix: ['x', 'y'] }), /occurs 2 times/);
    assert.throws(() => editSession(root, { fix: ['zzz', 'y'] }), /occurs 0 times/);
    assert.equal(read(join(root, '.ai', 'SESSION.md')), body);
  });

  ok('session --drop removes the entry and its indented continuation lines only', () => {
    const root = store();
    writeFileSync(join(root, '.ai', 'SESSION.md'), '# SESSION\n\n- [t] keep\n- [t] dead.rs gone\n  continuation of dead\n- [t] keep too\n');
    const r = editSession(root, { drop: 'dead.rs' });
    assert.equal(r.changed, 1);
    assert.equal(read(r.path), '# SESSION\n\n- [t] keep\n- [t] keep too\n');
    assert.throws(() => editSession(root, { drop: 'dead.rs' }), /no entry/);
  });

  const DECISION = '---\nid: ED-D001\ntitle: Pick a thing\nsummary: old summary\ndate: 2026-10-01\nsupersedes: \nsource: chris\n---\n\n**Decision:** thing A.\n\n**Why:** because.\n';

  ok('revise sets status and summary, stamps revised, keeps id and body', () => {
    const root = store();
    const file = join(root, '.ai', 'decisions', 'ED-D001-pick-a-thing.md');
    writeFileSync(file, DECISION);
    const r = reviseDecision(root, 'ED-D001', { status: 'decided', summary: 'new summary', now: new Date('2026-10-20T00:00:00Z') });
    const out = read(file);
    assert.deepEqual([...r.changed].sort(), ['status', 'summary']);
    assert.match(out, /^---\nid: ED-D001\ntitle: Pick a thing\nsummary: new summary\n/);
    assert.match(out, /status: decided\n/);
    assert.match(out, /revised: 2026-10-20\n---\n\n\*\*Decision:\*\* thing A\./);
  });

  ok('revise --promoted records where a project decision was promoted, leaving the body alone', () => {
    const root = store();
    const file = join(root, '.ai', 'decisions', 'ED-D001-pick-a-thing.md');
    writeFileSync(file, DECISION);
    const r = reviseDecision(root, 'ED-D001', { promoted: 'KIT-D110', now: new Date('2026-10-29T00:00:00Z') });
    const out = read(file);
    assert.deepEqual(r.changed, ['promoted']);
    assert.match(out, /promoted: KIT-D110\n/);
    assert.match(out, /\n---\n\n\*\*Decision:\*\* thing A\.\n\n\*\*Why:\*\* because\.\n$/);
  });

  ok('revise --file replaces the body; a body without Decision/Why and an unknown id refuse', () => {
    const root = store();
    const file = join(root, '.ai', 'decisions', 'ED-D001-pick-a-thing.md');
    writeFileSync(file, DECISION);
    reviseDecision(root, 'ED-D001', { draftText: '---\nsummary: from draft\n---\n\n**Decision:** thing B.\n\n**Why:** better.\n' });
    const out = read(file);
    assert.match(out, /summary: from draft/);
    assert.match(out, /\*\*Decision:\*\* thing B\./);
    assert.doesNotMatch(out, /thing A/);
    assert.throws(() => reviseDecision(root, 'ED-D001', { draftText: 'no sections here' }), /Decision:\*\* and \*\*Why/);
    assert.throws(() => reviseDecision(root, 'ED-D009', { status: 'x' }), /no decision ED-D009/);
    assert.throws(() => reviseDecision(root, 'ED-D001', {}), /nothing to change/);
  });

  ok('triage makes the ticket from the capture and files the capture under triaged/', () => {
    const root = store();
    const cap = join(root, '.ai', 'inbox', '2026-10-19-1200-bug-it-breaks.md');
    writeFileSync(cap, '(bug) It breaks on open\nsecond line of detail\n');
    const r = triageCapture(root, '2026-10-19-1200-bug-it-breaks.md', {}, scaffoldNew);
    assert.equal(r.id, 'ED-T001');
    assert.match(read(r.path), /title: It breaks on open[\s\S]*## Description\nIt breaks on open\nsecond line of detail/);
    assert.equal(existsSync(cap), false);
    assert.equal(existsSync(join(root, '.ai', 'inbox', 'triaged', '2026-10-19-1200-bug-it-breaks.md')), true);
  });

  ok('negative: triage refuses an untyped capture, a missing one, and a second run', () => {
    const root = store();
    writeFileSync(join(root, '.ai', 'inbox', 'a.md'), 'plain prose\n');
    assert.throws(() => triageCapture(root, 'a.md', {}, scaffoldNew), /no \(type\) tag/);
    assert.throws(() => triageCapture(root, 'nope.md', {}, scaffoldNew), /no capture/);
    triageCapture(root, 'a.md', { type: 'bug' }, scaffoldNew);
    assert.throws(() => triageCapture(root, 'a.md', {}, scaffoldNew), /no capture/);
  });

  ok('splitDraft separates a whole-ticket draft; plain prose stays the description', () => {
    const d = splitDraft('## Description\nthe why\n\n## Acceptance Criteria\n- [ ] one\n\n## Plan\n1. do\n\n## History\n- ignored\n');
    assert.deepEqual(d, { description: 'the why', criteria: '- [ ] one', plan: '1. do', notes: '' });
    assert.equal(splitDraft('just prose').description, 'just prose');
  });

  ok('t new with a whole-ticket draft fills the template sections and does not nest headings', () => {
    const root = store();
    const r = scaffoldNew(root, 'bug', 'Whole draft', { description: '## Description\nthe why\n\n## Acceptance Criteria\n- [ ] it works\n\n## Plan\n1. fix it\n' });
    const out = read(r.path);
    assert.equal(out.match(/^## Description$/gm).length, 1);
    assert.equal(out.match(/^## Acceptance Criteria$/gm).length, 1);
    assert.match(out, /## Description\nthe why\n\n## Acceptance Criteria\n<!-- .* -->\n- \[ \] it works\n\n## Plan\n1\. fix it\n/);
  });

  ok('the CLI wires session --fix, revise and triage', () => {
    const root = store();
    writeFileSync(join(root, '.ai', 'SESSION.md'), '# SESSION\n\n- keep old\n');
    writeFileSync(join(root, '.ai', 'decisions', 'ED-D001-pick-a-thing.md'), DECISION);
    writeFileSync(join(root, '.ai', 'inbox', 'c.md'), '(bug) cli capture\n');
    assert.match(runT(root, 'session', '--fix', 'old', 'new').stdout, /session: .* fixed/);
    assert.match(read(join(root, '.ai', 'SESSION.md')), /keep new/);
    assert.match(runT(root, 'revise', 'ED-D001', '--status-to', 'decided').stdout, /revise: ED-D001 changed status/);
    assert.match(runT(root, 'triage', 'c.md').stdout, /triage: ED-T001 .*triaged/);
  });
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
