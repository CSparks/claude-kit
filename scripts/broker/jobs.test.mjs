// jobs.test.mjs — the broker's cargo -j (KIT-T472): auto uses the cores the RAM can feed; a
// configured number pins it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBroker } from './config.mjs';
import { autoJobs, resolveJobs } from './jobs.mjs';

const GIB = 2 ** 30;
const box = { cores: 32, memBytes: 64 * GIB };

test('auto is bounded by both the cores and the memory', () => {
  assert.equal(autoJobs(box), 16, '64 GiB feeds 16 jobs on 32 cores');
  assert.equal(autoJobs({ cores: 8, memBytes: 64 * GIB }), 8, 'cores bound');
  assert.equal(autoJobs({ cores: 32, memBytes: 2 * GIB }), 1, 'never below one');
  assert.equal(resolveJobs('auto', box), 16);
  assert.equal(resolveJobs(undefined, box), 16, 'absent means auto');
});

test('negative: a configured number pins -j, and junk falls back to auto rather than to 0', () => {
  assert.equal(resolveJobs(3, box), 3);
  assert.equal(resolveJobs('6', box), 6);
  assert.equal(resolveJobs(0, box), 16);
  assert.equal(resolveJobs('many', box), 16);
  assert.equal(normalizeBroker('.', { parallelism: { jobs: 5 } }).jobs, 5);
});
