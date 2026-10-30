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
import { fileKitBug } from './overrun.mjs';

test('a fixture job over the ceiling never files a bug into the real kit store (KIT-T625)', () => {
  assert.equal(fileKitBug({ text: 'fixture overrun that must not be filed' }), false);
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
