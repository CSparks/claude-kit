#!/usr/bin/env node
// t-verbs.test.mjs — the store-writing verbs (KIT-T509): t note | epic | request | question
// create their item from the store template with a minted id; t notes appends to ## Notes;
// t session adds to the anchor without deleting (KIT-T521); t status/tick address epics and requests; t new takes a description.
// Bad args are refused before an id is minted.
// Run: node scripts/t-verbs.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createItem } from './t-create.mjs';
import { appendNotes } from './t-notes.mjs';
import { writeSession } from './t-session.mjs';
import { scaffoldNew, tick } from './t.mjs';
import { setStatus } from './t/status.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_AI = join(HERE, '..', '.ai');
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };
const dirs = [];

function store() {
  const root = mkdtempSync(join(tmpdir(), 'kit-verbs-'));
  dirs.push(root);
  const key = `V${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  for (const s of ['tickets', 'epics', 'requests', 'notes', 'questions']) {
    mkdirSync(join(root, '.ai', s), { recursive: true });
    if (s !== 'tickets') copyFileSync(join(KIT_AI, s, '_TEMPLATE.md'), join(root, '.ai', s, '_TEMPLATE.md'));
  }
  writeFileSync(join(root, '.ai', 'config.yml'), `classifications:\n  bug: { routes_to: tickets, priority: high }\n  epic: { routes_to: epics, priority: medium }\nstatuses:\n  flow: [todo, doing, review, done]\nuat:\n  default: none\nids:\n  key: "${key}"\n  pad: 3\n`);
  return { root, key };
}
const text = (path) => readFileSync(path, 'utf8');

try {
  ok('t note/epic/request/question mint the next id of their store and fill the template', () => {
    const s = store();
    const n = createItem(s.root, 'note', 'pre-write is long', { body: 'the observation' });
    const e = createItem(s.root, 'epic', 'Wrap stores', { body: 'the goal', priority: 'high' });
    const r = createItem(s.root, 'request', 'Please wrap');
    const q = createItem(s.root, 'question', 'Is it ok?', { answerableBy: 'claude' });
    assert.deepEqual([n.id, e.id, r.id, q.id], ['N', 'E', 'R', 'Q'].map((l) => `${s.key}-${l}001`));
    assert.match(text(n.path), /^---\nid: .*-N001\ntitle: pre-write is long\n[\s\S]*the observation\n/);
    assert.match(text(e.path), /priority: high[\s\S]*## Description\nthe goal\n/);
    assert.match(text(r.path), /## Description\nPlease wrap\n/);
    assert.match(text(q.path), /answerable_by: claude[\s\S]*\*\*Q:\*\* Is it ok\?/);
    for (const item of [e, r]) assert.doesNotMatch(text(item.path), /<YYYY-MM-DD HH:MM>/, 'History stamped');
    assert.equal(createItem(s.root, 'note', 'second').id, `${s.key}-N002`);
  });

  ok('negative: empty/multi-line title, bad priority, bad answerer, unknown kind mint no id', () => {
    const s = store();
    for (const [kind, title, opts] of [['note', ' ', {}], ['epic', 'a\nb', {}], ['request', 'x', { priority: 'urgent' }], ['question', 'q', { answerableBy: 'bob' }], ['widget', 'x', {}]]) {
      assert.throws(() => createItem(s.root, kind, title, opts), /^Error: t[: ]/);
    }
    assert.deepEqual(readdirSync(join(s.root, '.ai', 'notes')), ['_TEMPLATE.md']);
    assert.equal(createItem(s.root, 'note', 'first').id, `${s.key}-N001`);
  });

  ok('t notes appends prose under ## Notes of a ticket and creates the section on a note', () => {
    const s = store();
    const t = scaffoldNew(s.root, 'bug', 'a bug', { description: 'why' });
    appendNotes(s.root, t.id, 'first line\nsecond line');
    assert.match(text(t.path), /## Notes\n[\s\S]*first line\nsecond line\n[\s\S]*## History/);
    const n = createItem(s.root, 'note', 'obs');
    appendNotes(s.root, n.id, 'more');
    assert.match(text(n.path), /## Notes\nmore\n$/);
    assert.throws(() => appendNotes(s.root, `${s.key}-T999`, 'x'), /unknown id/);
    assert.throws(() => appendNotes(s.root, t.id, '  '), /non-empty/);
  });

  const ANCHOR = '# SESSION\n\n## Current state\n\nold state line\n\n## FRAMEWORK PROGRAMME\n\n- [2026-10-01] kept entry\n';
  const sessionFile = (root) => join(root, '.ai', 'SESSION.md');
  const backupDir = (root) => join(root, '.ai', '.session-backups');
  const backups = (root) => readdirSync(backupDir(root)).filter((f) => f.endsWith('.md')).sort();

  ok('t session adds a dated line under the top section and keeps every prior line (KIT-T521)', () => {
    const s = store();
    writeFileSync(sessionFile(s.root), ANCHOR);
    writeSession(s.root, 'state now\nnext: ship', { now: new Date('2026-10-15T12:00:00Z') });
    const out = text(sessionFile(s.root));
    for (const line of ANCHOR.split('\n')) assert.ok(out.includes(line), `kept: ${line}`);
    assert.match(out, /## Current state\n\n- \[2026-10-15 12:00\] state now\n {2}next: ship\n\nold state line/);
    writeSession(s.root, 'second', { now: new Date('2026-10-15T12:01:00Z') });
    assert.match(text(sessionFile(s.root)), /- \[2026-10-15 12:01\] second\n- \[2026-10-15 12:00\] state now/);
    assert.match(text(sessionFile(s.root)), /kept entry/);
  });

  ok('negative control: the old overwrite is gone, plain text never shrinks the file', () => {
    const s = store();
    writeFileSync(sessionFile(s.root), ANCHOR);
    writeSession(s.root, '# one line only');
    assert.ok(text(sessionFile(s.root)).length > ANCHOR.length);
    assert.ok(text(sessionFile(s.root)).includes('old state line'));
  });

  ok('t session on a missing file creates a titled anchor; a file with no headings gets the line on top', () => {
    const s = store();
    writeSession(s.root, 'first', { now: new Date('2026-10-15T12:00:00Z') });
    assert.equal(text(sessionFile(s.root)), '# SESSION\n\n- [2026-10-15 12:00] first\n');
    writeFileSync(sessionFile(s.root), 'loose notes\n');
    writeSession(s.root, 'top', { now: new Date('2026-10-15T12:00:00Z') });
    assert.equal(text(sessionFile(s.root)), '- [2026-10-15 12:00] top\n\nloose notes\n');
  });

  ok('--replace needs --file, and replaces only then', () => {
    const s = store();
    writeFileSync(sessionFile(s.root), ANCHOR);
    assert.throws(() => writeSession(s.root, 'x', { replace: true }), /needs a complete draft/);
    assert.equal(text(sessionFile(s.root)), ANCHOR, 'a refused replace changes nothing');
    assert.equal(existsSync(backupDir(s.root)), false, 'and backs nothing up');
    writeSession(s.root, '# fresh', { replace: true, fromFile: true });
    assert.equal(text(sessionFile(s.root)), '# fresh\n');
    assert.equal(text(join(backupDir(s.root), backups(s.root)[0])), ANCHOR, 'the replaced anchor is recoverable');
  });

  ok('--append adds a block at the end; empty text is refused', () => {
    const s = store();
    writeFileSync(sessionFile(s.root), ANCHOR);
    writeSession(s.root, 'tail block', { append: true });
    assert.equal(text(sessionFile(s.root)), `${ANCHOR}\ntail block\n`);
    assert.throws(() => writeSession(s.root, ' '), /non-empty/);
  });

  ok('every write leaves a backup of the previous file; only the last 20 stay', () => {
    const s = store();
    writeFileSync(sessionFile(s.root), ANCHOR);
    for (let i = 0; i < 25; i++) writeSession(s.root, `n${i}`, { now: new Date(Date.UTC(2026, 9, 15, 12, i)) });
    const kept = backups(s.root);
    assert.equal(kept.length, 20);
    assert.ok(text(join(backupDir(s.root), kept[kept.length - 1])).includes('n23'), 'the newest backup is the file before the last write');
    assert.equal(text(join(backupDir(s.root), '.gitignore')), '*\n');
  });

  ok('the CLI: --replace without --file exits 2 and leaves the anchor; plain text keeps it', () => {
    const s = store();
    writeFileSync(sessionFile(s.root), ANCHOR);
    const cli = join(HERE, 't.mjs');
    const reg = join(s.root, 'registry.json');
    writeFileSync(reg, '{}\n');
    const env = { ...process.env, CLAUDE_KIT_REGISTRY: reg };
    const bad = spawnSync(process.execPath, [cli, 'session', 'x', '--replace', '--root', s.root], { encoding: 'utf8', env });
    assert.equal(bad.status, 2);
    assert.equal(text(sessionFile(s.root)), ANCHOR);
    const good = spawnSync(process.execPath, [cli, 'session', 'flushed state', '--root', s.root], { encoding: 'utf8', env });
    assert.equal(good.status, 0, good.stderr);
    assert.match(good.stdout, /noted .*previous kept at/);
    assert.match(text(sessionFile(s.root)), /flushed state[\s\S]*old state line[\s\S]*kept entry/);
  });

  ok('t status and t tick address epics and requests; done leaves them in place', () => {
    const s = store();
    const e = createItem(s.root, 'epic', 'Wrap', { body: 'g' });
    const r = setStatus(s.root, e.id, 'done', {});
    assert.equal(r.archived, false);
    assert.ok(existsSync(e.path));
    assert.match(text(e.path), /status: done/);
    const q = createItem(s.root, 'request', 'Ask');
    writeFileSync(q.path, text(q.path).replace('- [ ]\n\n## Notes', '- [ ] works\n\n## Notes'));
    assert.equal(tick(s.root, q.id, 1).id, q.id);
  });

  ok('t new --description seeds the ticket body', () => {
    const s = store();
    const t = scaffoldNew(s.root, 'bug', 'with body', { description: 'real description' });
    assert.match(text(t.path), /## Description\nreal description\n/);
  });

  ok('the t CLI routes the verbs (spawn)', () => {
    const s = store();
    const reg = join(s.root, 'registry.json');
    writeFileSync(reg, '{}\n');
    const t = (...args) => spawnSync(process.execPath, [join(HERE, 't.mjs'), '--root', s.root, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_REGISTRY: reg } });
    assert.match(t('note', 'cli note', '--body', 'b').stdout, /note: .*-N001/);
    assert.match(t('session', 'anchor text').stdout, /session: .*SESSION\.md noted/);
    assert.match(t('notes', `${s.key}-N001`, 'appended').stdout, /notes: /);
    assert.equal(t('epic').status, 2, 'missing title is a usage error');
  });
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}
console.log(`\nt-verbs: ${passed} passed`);
