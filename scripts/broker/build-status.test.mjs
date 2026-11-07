// build-status.test.mjs — the plain-text readout of who is building (KIT-D135) and the audit of project settings over the budget.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditProjects, formatAudit } from './build-audit.mjs';
import { formatSnapshot } from './build-status.mjs';

const now = new Date().toISOString();
const SNAP = { physical: 16, reserve: 2, full: 14, budget: 14, game: false };

test('the readout names each holder with its cores and project, and each waiter', () => {
  const text = formatSnapshot({
    ...SNAP,
    holds: [{ jobs: 8, pid: 11, ts: now, label: 'D:\\dev\\stiletto: cargo t' }, { jobs: 4, pid: 12, ts: now, label: 'D:\\dev\\dirt-empire: cargo test' }],
    waiting: [{ jobs: 14, pid: 13, ts: now, label: 'D:\\dev\\pixelvision: cargo-ndk build' }],
  });
  assert.match(text, /build budget: 14 of 16 cores \(2 always free\)/);
  assert.match(text, /building 12\/14 cores:/);
  assert.match(text, / 8 cores {2}pid 11 {2}\d+s {2}D:\\dev\\stiletto: cargo t/);
  assert.match(text, /waiting 1:\n {2}want 14 {2}pid 13/);
});

test('an idle machine and a running game read plainly', () => {
  assert.match(formatSnapshot({ ...SNAP, holds: [], waiting: [] }), /building: nobody\nwaiting: nobody/);
  assert.match(formatSnapshot({ ...SNAP, budget: 8, game: true, holds: [], waiting: [] }), /a game is running, builds yield 6 of 14/);
});

test('the audit lists a project jobs setting above the budget and leaves one within it', () => {
  const root = mkdtempSync(join(tmpdir(), 'audit-'));
  try {
    for (const [name, jobs] of [['over', 24], ['within', 12]]) {
      const dir = join(root, name);
      mkdirSync(join(dir, '.cargo'), { recursive: true });
      writeFileSync(join(dir, '.cargo', 'config.toml'), `[build]\njobs = ${jobs}\n`);
    }
    mkdirSync(join(root, 'over', 'scripts'));
    writeFileSync(join(root, 'over', 'scripts', 'gate.sh'), 'cargo test -j 15\nmake -j 99\n');
    const found = auditProjects(14, { roots: [join(root, 'over'), join(root, 'within')] });
    assert.deepEqual(found.map((f) => [f.project, f.jobs]).sort(), [['over', 15], ['over', 24]]);
    assert.match(formatAudit(found), /over {2}jobs 24/);
    assert.equal(formatAudit([]), 'settings over the budget: none');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
