#!/usr/bin/env node
// framework-mirror.test.mjs — a framework-scope decision recorded with `t decide` in a game store is mirrored into the
// framework store as an open ticket the same turn and the decision is stamped `promoted:` (KIT-T943). Game-scope decisions,
// a decision already promoted, a decision in the framework's own store and a machine with no framework project mirror nothing.
// Run: node scripts/framework-mirror.test.mjs

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

process.env.KIT_USER = 'chris';
const holders = mkdtempSync(join(tmpdir(), 'fm-reg-'));
process.env.CLAUDE_KIT_REGISTRY = join(holders, 'registry.json');
const { recordDecision } = await import('./t-decide.mjs');
const { mirrorById } = await import('./framework-mirror.mjs');
const { unpromoted } = await import('./decision-promotion.mjs');

const unique = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const CONFIG = (key) => `ids:\n  key: "${key}"\n  pad: 3\nclassifications:\n  bug:\n  feature:\n  task:\n`;

function store(name, key) {
  const root = mkdtempSync(join(tmpdir(), `fm-${name}-`));
  mkdirSync(join(root, '.ai', 'decisions'), { recursive: true });
  mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), CONFIG(key));
  return root;
}

const DE_D077_BODY = '**Decision:** Chris 2026-11-02, verbatim: "There probably should be a foliage crate that\'s part of the framework. Same with rocks/boulders. Stiletto/this game could/should both use the same code." Foliage and rocks/boulders/debris get framework crates in rapid-game.\n\n**Why:** a game-local copy of something generic is a defect.\n';
const draft = (title, summary = '') => `---\ntitle: ${title}\nsummary: ${summary}\nsource: chat\ndate: 2026-11-02\n---\n\n${DE_D077_BODY}`;
const FRAMEWORK_TITLE = 'Foliage, rocks and boulders are framework crates shared by Stiletto and Dirt Empire';
const GAME_TITLE = 'The garage menu shows a rotating truck';

function world({ registered = true } = {}) {
  const key = `G${unique()}`;
  const fwKey = `R${unique()}`;
  const game = store('game', key);
  const framework = store('framework', fwKey);
  writeFileSync(process.env.CLAUDE_KIT_REGISTRY, JSON.stringify({ projects: registered ? { 'rapid-game': framework, [`game-${key}`]: game } : { [`game-${key}`]: game } }));
  return { game, framework, key, fwKey, done: () => { rmSync(game, { recursive: true, force: true }); rmSync(framework, { recursive: true, force: true }); } };
}
const tickets = (root) => readdirSync(join(root, '.ai', 'tickets'));

test('a framework-scope decision recorded in a game store becomes an open ticket in the framework store the same call', () => {
  const w = world();
  try {
    const r = recordDecision(w.game, draft(FRAMEWORK_TITLE, 'framework foliage and rocks crates'));
    assert.ok(r.mirrored, 'the result names the mirror');
    assert.match(r.mirrored.ticket, new RegExp(`^${w.fwKey}-T001$`));
    const [file] = tickets(w.framework);
    assert.match(file, new RegExp(`^${w.fwKey}-T001-`));
    const ticket = readFileSync(join(w.framework, '.ai', 'tickets', file), 'utf8');
    assert.match(ticket, /^status: todo$/m);
    assert.match(ticket, /^priority: high$/m);
    assert.match(ticket, /^labels: \[framework-decision\]$/m);
    assert.match(ticket, new RegExp(`links: \\[${r.id}\\]`));
    assert.ok(ticket.includes(r.id) && ticket.includes('foliage crate'), 'the ticket cites the decision id and carries its words');
    assert.match(readFileSync(r.path, 'utf8'), new RegExp(`^---\\npromoted: ${w.fwKey}-T001\\n`));
  } finally { w.done(); }
});

test('the promoted: line clears the decision from the unpromoted list (KIT-D111)', () => {
  const w = world();
  try {
    const kit = mkdtempSync(join(tmpdir(), 'fm-kit-'));
    mkdirSync(join(kit, '.ai', 'decisions'), { recursive: true });
    recordDecision(w.game, draft(FRAMEWORK_TITLE));
    assert.deepEqual(unpromoted(w.game, { kitRoot: kit, registry: process.env.CLAUDE_KIT_REGISTRY }), []);
    rmSync(kit, { recursive: true, force: true });
  } finally { w.done(); }
});

test('negative control: a game-scope decision is not mirrored', () => {
  const w = world();
  try {
    const r = recordDecision(w.game, draft(GAME_TITLE));
    assert.equal(r.mirrored, undefined);
    assert.deepEqual(tickets(w.framework), []);
    assert.ok(!/promoted:/.test(readFileSync(r.path, 'utf8')));
  } finally { w.done(); }
});

test('negative control: a decision recorded in the framework store itself is not mirrored back', () => {
  const w = world();
  try {
    const r = recordDecision(w.framework, draft(FRAMEWORK_TITLE));
    assert.equal(r.mirrored, undefined);
    assert.deepEqual(tickets(w.framework), []);
  } finally { w.done(); }
});

test('negative control: no framework project on the machine mirrors nothing and the decision still lands', () => {
  const w = world({ registered: false });
  try {
    const r = recordDecision(w.game, draft(FRAMEWORK_TITLE));
    assert.equal(r.mirrored, undefined);
    assert.equal(r.mirrorError, undefined);
    assert.ok(readFileSync(r.path, 'utf8').includes(r.id));
  } finally { w.done(); }
});

test('backfill by id mirrors one recorded decision once; a second call finds it promoted', () => {
  const w = world({ registered: false });
  try {
    const r = recordDecision(w.game, draft(FRAMEWORK_TITLE));
    writeFileSync(process.env.CLAUDE_KIT_REGISTRY, JSON.stringify({ projects: { 'rapid-game': w.framework } }));
    const first = mirrorById(w.game, r.id);
    assert.match(first.ticket, new RegExp(`^${w.fwKey}-T001$`));
    assert.equal(mirrorById(w.game, r.id), null);
    assert.equal(tickets(w.framework).length, 1);
    assert.throws(() => mirrorById(w.game, `${w.key}-D999`), /no decision/);
  } finally { w.done(); }
});

test('a framework store with no config is skipped without losing the decision', () => {
  const w = world();
  try {
    rmSync(join(w.framework, '.ai', 'config.yml'));
    const r = recordDecision(w.game, draft(FRAMEWORK_TITLE));
    assert.equal(r.mirrored, undefined);
    assert.ok(readFileSync(r.path, 'utf8').includes(r.id));
  } finally { w.done(); }
});
