// q show resolves every id the cache indexes (KIT-T922, KIT-T412, KIT-T512, KIT-T382): the synthetic
// <KEY>-INBOX-<stem> / <KEY>-QUESTIONS-<stem> ids that `q fts` and `q inbox` list for id-less files
// are showable by their full id or an unambiguous prefix, in the project store and in another key's store.
// Run: node scripts/q-show.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

// --project <name|key> (KIT-T1063): read another project's item, or pin the lookup to one store.
const registry = join(tmp, 'registry.json');
writeFileSync(registry, JSON.stringify({ projects: { gg, kit } }));
const Q = join(dirname(fileURLToPath(import.meta.url)), 'q.mjs');
const q = (args, cwd) => {
  const r = spawnSync(process.execPath, [Q, 'show', ...args], { cwd, encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_REGISTRY: registry, CLAUDE_KIT_BUG_STORE: 'off' } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

test('--project <name> shows another project\'s item from this checkout', () => {
  const r = q(['GGX-T001', '--project', 'gg'], kit);
  assert.equal(r.code, 0);
  assert.match(r.out, /real body/);
});

test('--project takes the id key and the flag may lead', () => {
  assert.match(q(['GGX-T001', '--project', 'GGX'], kit).out, /real body/);
  assert.match(q(['--project', 'gg', 'GGX-T001'], kit).out, /real body/);
  assert.match(q(['GGX-T001', '--project=gg'], kit).out, /real body/);
  assert.match(q(['GGX-T001', '--scope', 'GGX'], kit).out, /real body/);
});

test('control: --project pins the lookup to that store, so another project\'s id is a miss', () => {
  const r = q(['KIT-INBOX-2026-11-09-2140-note-kit-capture', '--project', 'gg'], kit);
  assert.match(r.out, /no item/);
  assert.match(r.out, /gg/);
  assert.doesNotMatch(r.out, /a kit store capture/);
});

test('control: an unknown project is an error naming the registered ones', () => {
  const r = q(['GGX-T001', '--project', 'nope'], kit);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown project 'nope'.*registered: .*gg/);
});

test('control: --project without a value is an error', () => {
  const r = q(['GGX-T001', '--project'], kit);
  assert.equal(r.code, 1);
  assert.match(r.out, /--project takes a value/);
});

test('control: --project with no id prints the usage line', () => {
  assert.match(q(['--project', 'gg'], kit).out, /usage: q show <id>/);
});

test('control: a plain q show still finds another registered project\'s id with no flag', () => {
  assert.match(q(['GGX-T001'], kit).out, /real body/);
});
