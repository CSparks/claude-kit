#!/usr/bin/env node
// t-verbs.test.mjs — the store-writing verbs (KIT-T509): t note | epic | request | question
// create their item from the store template with a minted id; t notes appends to ## Notes;
// t session writes the anchor; t status/tick address epics and requests; t new takes a description.
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

  ok('t session replaces the anchor, --append adds a block, empty text is refused', () => {
    const s = store();
    writeSession(s.root, '# one\nstate');
    writeSession(s.root, '# two');
    assert.equal(text(join(s.root, '.ai', 'SESSION.md')), '# two\n');
    writeSession(s.root, 'next 3 steps', { append: true });
    assert.equal(text(join(s.root, '.ai', 'SESSION.md')), '# two\n\nnext 3 steps\n');
    assert.throws(() => writeSession(s.root, ' '), /non-empty/);
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
    assert.match(t('session', 'anchor text').stdout, /session: .*SESSION\.md written/);
    assert.match(t('notes', `${s.key}-N001`, 'appended').stdout, /notes: /);
    assert.equal(t('epic').status, 2, 'missing title is a usage error');
  });
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}
console.log(`\nt-verbs: ${passed} passed`);
