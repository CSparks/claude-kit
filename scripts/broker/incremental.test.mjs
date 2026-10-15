// incremental.test.mjs — rustc's incremental caches stay bounded (KIT-T483): after a suite run the
// daemon drops each unit unused for `incremental_keep_hours` (never one written within 15 minutes), and drops sessions a killed build left `-working`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { pruneIncremental } from './incremental.mjs';
import { processOnce } from './queue.mjs';
import { fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const HOUR = 3600 * 1000;
const NOW = Date.parse('2026-10-15T12:00:00Z');

// <target>/debug/incremental/<crate>-<hash>/s-<session>/ with a 1000-byte file; aged `hours`.
function unit(target, name, hours, { working = false, now = NOW } = {}) {
  const dir = join(target, 'debug', 'incremental', name);
  const session = join(dir, working ? 's-1-working' : 's-1-done');
  mkdirSync(session, { recursive: true });
  writeFileSync(join(session, 'dep-graph.bin'), Buffer.alloc(1000));
  const t = new Date(now - hours * HOUR);
  for (const p of [join(session, 'dep-graph.bin'), session, dir]) utimesSync(p, t, t);
  return dir;
}

test('a crate lib and test-harness units both survive while recent; an old unit of either kind goes', () => {
  const target = tempDir('incr-');
  try {
    const lib = unit(target, 'game-aaaa', 2);
    const harness = unit(target, 'game-cccc', 3);
    const oldDuplicate = unit(target, 'game-bbbb', 100);
    const lone = unit(target, 'rg_input-dddd', 500);
    const justWritten = unit(target, 'game-eeee', 0.1);
    const r = pruneIncremental(target, { keepHours: 0, now: NOW });
    assert.deepEqual([lib, harness, oldDuplicate, lone, justWritten].map(existsSync), [false, false, false, false, true], 'keepHours 0: only the grace window protects');
    const kept = pruneIncremental(target, { keepHours: 24, now: NOW });
    assert.equal(kept.removed, 0);
    assert.equal(r.removed, 4);
  } finally { cleanup(target); }
});

test('same-crate units of two build kinds survive the window; only the stale one is pruned (negative control)', () => {
  const target = tempDir('incr-');
  try {
    const lib = unit(target, 'game-aaaa', 2);
    const harness = unit(target, 'game-cccc', 3);
    const stale = unit(target, 'game-bbbb', 100);
    pruneIncremental(target, { keepHours: 24, now: NOW });
    assert.deepEqual([lib, harness, stale].map(existsSync), [true, true, false]);
  } finally { cleanup(target); }
});

test('a leftover trash name is swept by the next prune', () => {
  const target = tempDir('incr-');
  try {
    const junk = unit(target, 'game-aaaa.trash-1-2', 0);
    unit(target, 'game-bbbb', 0);
    pruneIncremental(target, { keepHours: 24, now: Date.now() });
    assert.equal(existsSync(junk), false);
  } finally { cleanup(target); }
});

test('a session a killed build left -working is dropped once an hour old; dry run deletes nothing', () => {
  const target = tempDir('incr-');
  try {
    const dir = unit(target, 'game-aaaa', 2, { working: true });
    const dry = pruneIncremental(target, { keepHours: 24, now: NOW, dryRun: true });
    assert.equal(dry.removed, 1);
    assert.ok(existsSync(join(dir, 's-1-working')), 'dry run');
    pruneIncremental(target, { keepHours: 24, now: NOW });
    assert.equal(existsSync(join(dir, 's-1-working')), false);
    assert.ok(existsSync(dir), 'the unit itself stays');
  } finally { cleanup(target); }
});

test('the daemon prunes after a suite run; incremental_keep_hours: off leaves the caches alone (negative control)', () => {
  for (const [keep, expectGone] of [[0, true], ['off', false]]) {
    const s = fixture();
    try {
      s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], land_gate: 'affected', suite: ['node -e 0'], incremental_keep_hours: keep });
      const stale = unit(s.cfg.targetDir, 'game-aaaa', 1, { now: Date.now() });
      unit(s.cfg.targetDir, 'game-bbbb', 0, { now: Date.now() });
      const sum = processOnce(s.cfg);
      assert.ok(sum.suite, 'an idle drain ran the suite');
      assert.equal(!existsSync(stale), expectGone, `keep ${keep}`);
      if (expectGone) assert.match(sum.suite.pruned, /incremental caches .* \(1 removed\)/);
    } finally { s.done(); }
  }
});
