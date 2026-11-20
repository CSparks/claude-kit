#!/usr/bin/env node
// t-framework-id.test.mjs — `t` verbs address the framework store by item id (KIT-T1443). The framework store lives in the
// central data root and its registered checkout (a game's submodule) holds no `.ai` link, so a verb run from the game or from
// the submodule used to read the game's store and answer "unknown id RG-T390". Controls: the game's own ids, an id the
// framework does not carry, a project that does not consume the framework and another project's id keep the resolved store.
// Run: node scripts/t-framework-id.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const T = join(dirname(fileURLToPath(import.meta.url)), 't.mjs');
const base = mkdtempSync(join(tmpdir(), 'kit-fwid-'));
const registry = join(base, 'registry.json');
const env = { ...process.env, CLAUDE_KIT_REGISTRY: registry, CLAUDE_KIT_DB: join(base, 'cache.sqlite'), CLAUDE_KIT_REFRESH_TIMEOUT_MS: '20000' };

const CONFIG = (key) => `uat:\n  default: none\nids:\n  key: "${key}"\n  pad: 3\nclassifications:\n  task: { routes_to: tickets, priority: medium }\nstatuses:\n  flow: [todo, doing, review, done]\n`;
const ticket = (id) => `---\nid: ${id}\ntitle: seeded ${id}\ntype: task\nstatus: todo\npriority: medium\nlinks: []\ncreated: 2026-11-20T00:00:00Z\nupdated: 2026-11-20T00:00:00Z\n---\n\n## Description\nseed\n\n## Notes\n\n## History\n- [2026-11-20 00:00] (created) task\n`;

function seed(aiDir, key, id) {
  mkdirSync(join(aiDir, 'tickets'), { recursive: true });
  writeFileSync(join(aiDir, 'config.yml'), CONFIG(key));
  writeFileSync(join(aiDir, 'tickets', `${id}-seed.md`), ticket(id));
  return join(aiDir, 'tickets', `${id}-seed.md`);
}

const central = join(base, 'data', 'projects', 'rapid-game');
const other = join(base, 'data', 'projects', 'other');
const frameworkTicket = seed(central, 'FWX', 'FWX-T001');
const otherTicket = seed(other, 'OTX', 'OTX-T001');

const game = join(base, 'game');
const gameTicket = seed(join(game, '.ai'), 'GMX', 'GMX-T001');
writeFileSync(join(game, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
const sub = join(game, 'rapid-game');
mkdirSync(join(sub, '.ai', 'decisions'), { recursive: true });
writeFileSync(join(sub, '.git'), 'gitdir: ../.git/modules/rapid-game\n');

const loner = join(base, 'loner');
seed(join(loner, '.ai'), 'LNX', 'LNX-T001');

writeFileSync(registry, JSON.stringify({ dataRoot: join(base, 'data'), projects: { game, loner, 'rapid-game': sub, other: join(base, 'nowhere') }, excluded: [] }));

const run = (cwd, ...args) => spawnSync(process.execPath, [T, ...args], { cwd, env, encoding: 'utf8' });
const read = (path) => readFileSync(path, 'utf8');
const output = (r) => `${r.stdout}${r.stderr}`;

test('a framework id run from the game writes the framework store', () => {
  const r = run(game, 'notes', 'FWX-T001', 'audit from the game');
  assert.equal(r.status, 0, output(r));
  assert.match(read(frameworkTicket), /audit from the game/);
});

test('a framework id run from inside the submodule writes the framework store', () => {
  mkdirSync(join(sub, 'rust'), { recursive: true });
  for (const cwd of [sub, join(sub, 'rust')]) {
    const r = run(cwd, 'notes', 'FWX-T001', `audit from ${cwd.length}`);
    assert.equal(r.status, 0, output(r));
    assert.match(read(frameworkTicket), new RegExp(`audit from ${cwd.length}`));
  }
});

test('another id verb (comment) reaches the framework store too', () => {
  const r = run(game, 'comment', 'FWX-T001', 'seen from the game', '--author', 'tester');
  assert.equal(r.status, 0, output(r));
  assert.match(read(frameworkTicket), /seen from the game/);
});

test('the store root made for the central store is a link to it, reused on the next call', () => {
  const link = join(base, 'claude-kit-store-roots', 'rapid-game', '.ai');
  assert.ok(lstatSync(link).isSymbolicLink());
  assert.equal(realpathSync.native(link).toLowerCase(), realpathSync.native(central).toLowerCase());
  assert.equal(run(game, 'notes', 'FWX-T001', 'again').status, 0);
});

test('control: the game keeps its own ids', () => {
  const r = run(game, 'notes', 'GMX-T001', 'game note');
  assert.equal(r.status, 0, output(r));
  assert.match(read(gameTicket), /game note/);
  assert.doesNotMatch(read(frameworkTicket), /game note/);
});

test('control: a framework-keyed id the framework does not carry fails and names the framework store', () => {
  const r = run(game, 'notes', 'FWX-T999', 'nope');
  assert.notEqual(r.status, 0);
  assert.match(output(r), /unknown id 'FWX-T999'.*claude-kit-store-roots/);
});

test('control: another project\'s id is not reachable from the game', () => {
  const r = run(game, 'notes', 'OTX-T001', 'nope');
  assert.notEqual(r.status, 0);
  assert.match(output(r), /unknown id 'OTX-T001'/);
  assert.doesNotMatch(read(otherTicket), /nope/);
});

test('control: a project that does not consume the framework keeps its own store', () => {
  const r = run(loner, 'notes', 'FWX-T001', 'nope');
  assert.notEqual(r.status, 0);
  assert.match(output(r), /unknown id 'FWX-T001'/);
  assert.doesNotMatch(read(frameworkTicket), /nope/);
});

test('control: an explicit --root is honoured over the id routing', () => {
  const r = run(game, 'notes', 'FWX-T001', 'nope', '--root', game);
  assert.notEqual(r.status, 0);
  assert.match(output(r), /unknown id 'FWX-T001'/);
});

test.after(() => rmSync(base, { recursive: true, force: true }));
