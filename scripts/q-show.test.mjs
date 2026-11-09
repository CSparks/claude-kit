// q show resolves every id the cache indexes (KIT-T922, KIT-T412, KIT-T512, KIT-T382): the synthetic
// <KEY>-INBOX-<stem> / <KEY>-QUESTIONS-<stem> ids that `q fts` and `q inbox` list for id-less files
// are showable by their full id or an unambiguous prefix, in the project store and in another key's store.
// Run: node scripts/q-show.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectItems } from './db-parse.mjs';
import { showRows } from './q-show.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'kit-q-show-'));
test.after(() => rmSync(tmp, { recursive: true, force: true }));

function project(name, key, files) {
  const root = join(tmp, name);
  mkdirSync(join(root, '.ai'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), `ids:\n  key: "${key}"\n  pad: 3\n`);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, '.ai', rel, '..'), { recursive: true });
    writeFileSync(join(root, '.ai', rel), text);
  }
  return root;
}

const FILES = {
  'inbox/2026-11-09-2305-note-song-generator-shared-roles.md': 'note: shared roles and pads need a rule\n',
  'inbox/2026-11-09-2306-bug-other-capture.md': 'bug: a second capture\n',
  'questions/2026-11-09-which-engine.md': 'which engine do we pick?\n',
  'tickets/GGX-T001-real-ticket.md': '---\nid: GGX-T001\ntitle: a real ticket\n---\nreal body\n',
};
const gg = project('gg', 'GGX', FILES);
const kit = project('kit', 'KIT', { 'inbox/2026-11-09-2140-note-kit-capture.md': 'note: a kit store capture\n' });
const text = (id, root) => showRows(id, root).join('\n');

test('every id the cache indexes resolves through q show (the invariant behind the reports)', () => {
  for (const { id, file } of collectItems(gg)) {
    assert.match(text(id, gg), new RegExp(`^# .*${file.split('/').pop().replace('.', '\\.')}`), id);
  }
});

test('a project inbox id that q fts lists shows the capture', () => {
  assert.match(text('GGX-INBOX-2026-11-09-2305-note-song-generator-shared-roles', gg), /shared roles and pads need a rule/);
});

test('the kit store inbox id shows too', () => {
  assert.match(text('KIT-INBOX-2026-11-09-2140-note-kit-capture', kit), /a kit store capture/);
});

test('a questions file id shows', () => {
  assert.match(text('GGX-QUESTIONS-2026-11-09-which-engine', gg), /which engine do we pick/);
});

test('an unambiguous prefix of an inbox id shows the capture', () => {
  assert.match(text('GGX-INBOX-2026-11-09-2305', gg), /shared roles and pads/);
});

test('control: a real ticket id still resolves', () => {
  assert.match(text('GGX-T001', gg), /real body/);
});

test('control: the same stem under another key is a miss', () => {
  assert.match(text('KIT-INBOX-2026-11-09-2305-note-song-generator-shared-roles', gg), /no item/);
});

test('control: a stem no inbox file carries is a miss', () => {
  assert.match(text('GGX-INBOX-2026-11-09-9999', gg), /no item/);
});

test('control: a stem prefix that does not end at a segment boundary is a miss', () => {
  assert.match(text('GGX-INBOX-2026-11-09-230', gg), /no item/);
});
