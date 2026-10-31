// testkit-slots.test.mjs — a broker test never queues on the machine's real build slots (KIT-T730):
// importing the testkit moves them to a private directory, so a long real build on the box cannot
// stall a pre-push gate test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import './testkit.mjs';
import { acquireBuildSlot, slotDir } from './build-slot.mjs';
import { NO_FILING_ENV } from './timing-tick.mjs';

test('the testkit forbids filing into the real kit store, so a fixture tick never files a time sink (KIT-T625)', () => {
  assert.ok(process.env[NO_FILING_ENV]);
});

test('the testkit gives this process a slot directory outside the real one', () => {
  const real = join(homedir(), '.claude', 'claude-kit-build-slots');
  assert.notEqual(resolve(slotDir()), resolve(real));
  assert.ok(resolve(slotDir()).toLowerCase().startsWith(realpathSync.native(tmpdir()).toLowerCase()));
});

test('a forced slot is granted at once while the real directory is held', () => {
  const slot = acquireBuildSlot('pre-push gate', { jobs: 1, force: true });
  assert.equal(slot.cancelled, false);
  slot.release();
});
