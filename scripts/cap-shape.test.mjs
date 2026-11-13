#!/usr/bin/env node
// Tests for the kit-capture dedup key (cap-dedup.mjs captureShape): an identical capture folds into the open ticket, and two
// captures that only share an opening phrase are two tickets.
// Run: node scripts/cap-shape.test.mjs

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cleanup, tmpDir } from '../hooks/test-harness.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const store = tmpDir('cap-shape-store-');
mkdirSync(join(store, '.ai', 'tickets'), { recursive: true });
copyFileSync(join(KIT, '.ai', 'config.yml'), join(store, '.ai', 'config.yml'));
process.env.CLAUDE_KIT_BUG_STORE = store;
process.env.CLAUDE_KIT_DB = join(store, 'workflow.db');
spawnSync('git', ['init', '-q'], { cwd: store });
const { asKitBug, captureShape } = await import('./cap-dedup.mjs');

const OPENING = 'process failure (road-generator main thread 2026-11-11): ';
const slugOf = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const file = (text) => asKitBug(join(store, '.ai'), text, slugOf(text), 'bug');

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

await test('the shape differs for two captures that share their opening 48 characters', () => {
  const a = `${OPENING}built a router beside the framework's`;
  const b = `${OPENING}ended a landing reply without a receipt`;
  assert.equal(slugOf(a), slugOf(b));
  assert.notEqual(captureShape('bug', slugOf(a), a), captureShape('bug', slugOf(b), b));
});

await test('the shape is stable across case, punctuation and spacing of the same words', () => {
  assert.equal(captureShape('bug', 's', 'Gate  misfires, twice!'), captureShape('bug', 's', 'gate misfires twice'));
});

await test('filing: two captures sharing an opening make two tickets; a repeat of one folds into its ticket', async () => {
  const a = `${OPENING}built a router beside the framework's`;
  const b = `${OPENING}ended a landing reply without a receipt`;
  const first = await file(a);
  const second = await file(b);
  const again = await file(a);
  assert.deepEqual([first.created, second.created, again.created], [true, true, false]);
  assert.notEqual(first.id, second.id);
  assert.equal(again.id, first.id);
});

cleanup();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
