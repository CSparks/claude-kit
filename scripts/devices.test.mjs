#!/usr/bin/env node
// devices.test.mjs — the device registry orient prints (KIT-T406).
// Run: node scripts/devices.test.mjs

import assert from 'node:assert/strict';
import { deviceBlock, deviceLines } from './devices.mjs';

const fake = {
  label: 'Test Rig',
  target: () => ({ host: '10.0.0.9', user: 'rig', key: '/home/x/.ssh/rig' }),
  games: () => ({ 'game-a': {} }),
  command: (p) => `rig-deploy ${p}`,
  tail: (t, p) => `ssh ${t.user}@${t.host} 'tail ${p}.log'`,
};

assert.deepEqual(deviceLines('game-b', [fake]), [], 'a project that is not a configured game gets no line');
assert.equal(deviceBlock('game-b', [fake]).length, 0, 'and no block');

const lines = deviceLines('game-a', [fake]);
assert.equal(lines.length, 1);
assert.match(lines[0], /Test Rig rig@10\.0\.0\.9: rig-deploy game-a .*log: ssh rig@10\.0\.0\.9 'tail game-a\.log'/);

const block = deviceBlock('game-a', [fake, { ...fake, label: 'Other', games: () => ({}) }]);
assert.match(block[0], /^--- DEVICES \/ DEPLOY TARGETS/);
assert.equal(block.length, 3, 'header, one line for the device that applies, trailing blank');

const broken = { ...fake, target: () => { throw new Error('no config'); } };
assert.deepEqual(deviceLines('game-a', [broken, fake]).length, 1, 'an unreadable device config is skipped, the rest still print');

console.log('devices: 6 passed, 0 failed');
