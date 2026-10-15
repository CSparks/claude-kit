// incremental.test.mjs — rustc's incremental caches stay bounded (KIT-T483): after a suite run the
// daemon drops each crate's units unused for `incremental_keep_hours`, always keeping a crate's
// newest unit, and drops sessions a killed build left `-working`.

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

test('units unused past the window go, each crate keeps its newest, recent alternates stay warm', () => {
  const target = tempDir('incr-');
  try {
    const libOld = unit(target, 'game-aaaa', 100);
    const libNew = unit(target, 'game-bbbb', 50);
    const testHarness = unit(target, 'game-cccc', 2);
    const lone = unit(target, 'rg_input-dddd', 500);
    const r = pruneIncremental(target, { keepHours: 24, now: NOW });
    assert.deepEqual([existsSync(libOld), existsSync(libNew), existsSync(testHarness), existsSync(lone)], [false, false, true, true]);
    assert.deepEqual([r.before, r.after, r.removed, r.dirs], [4000, 2000, 2, 4]);
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
