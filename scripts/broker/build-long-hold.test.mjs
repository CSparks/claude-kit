// build-long-hold.test.mjs — a hold past the 5-minute ceiling is filed as one kit bug (KIT-T1031).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LONG_HOLD_MS } from './build-grant.mjs';
import { flagLongHolds } from './build-long-hold.mjs';

const NOW = Date.parse('2026-11-11T12:00:00Z');
const hold = (name, ageMs) => ({ name, pid: 4242, jobs: 14, label: 'cargo test -p rg-camera -p rg-editor', cwd: 'D:\\dev\\dirt-empire', ts: new Date(NOW - ageMs).toISOString() });
const scratch = () => mkdtempSync(join(tmpdir(), 'long-hold-'));

test('a hold past the ceiling is filed once, naming job, root and minutes; later waiters file nothing', async () => {
  const dir = scratch();
  const filed = [];
  const file = (bug) => filed.push(bug);
  try {
    const holds = [hold('slot-a', 26 * 60000)];
    assert.equal((await flagLongHolds(holds, { dir, file, now: NOW })).length, 1);
    assert.equal((await flagLongHolds(holds, { dir, file, now: NOW + 5000 })).length, 0);
    assert.equal(filed.length, 1);
    assert.match(filed[0].detail, /rg-camera.*dirt-empire.*14 cores for 26 min/);
    assert.equal(filed[0].shape, `build-budget:over-ceiling:D:\\dev\\dirt-empire:cargo test -p rg-camera -p rg-editor`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a hold under the ceiling is not filed, and a marker whose hold ended is swept', async () => {
  const dir = scratch();
  const filed = [];
  try {
    writeFileSync(join(dir, 'flagged-slot-gone'), '');
    assert.equal((await flagLongHolds([hold('slot-b', LONG_HOLD_MS - 1000)], { dir, file: (b) => filed.push(b), now: NOW })).length, 0);
    assert.equal(filed.length, 0);
    assert.equal(existsSync(join(dir, 'flagged-slot-gone')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
