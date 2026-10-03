// paired.test.mjs — a failure beside a paired submodule pin is suspect, never deferred as
// foreign (KIT-T305). Fixture "tests" are node one-liners that always fail one test, as in
// attribute.test.mjs, so the baseline would call it foreign.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairedPins } from './paired.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { printResult } from './report.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';

const FAILS = `node -e "console.log('test a_foreign ... FAILED');console.log('---- a_foreign stdout ----');console.log('boom');process.exit(1)"`;
const pin = (ticket) => `chore: pin rapid-game 0123456789abcdef — the framework half (implements ${ticket}) [no-log: submodule pin]`;

// Submit a job on T-9, then land a pin commit for `pinTicket`, then run the queue.
function runWithPin(pinTicket) {
  const s = fixture();
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-9' }, '*** write marker.txt\nm\n');
  writeJob(s.cfg, { ...job, commands: [FAILS] });
  commitOnMain(s.root, 'rapid-game.txt', 'pinned\n', pin(pinTicket));
  processOnce(s.cfg);
  return { s, r: readResult(s.cfg, job.id), base: job.base };
}

test('a paired pin for the same ticket makes a failing test suspect and fails the job', () => {
  const { s, r } = runWithPin('T-9');
  try {
    assert.equal(r.status, 'failed');
    assert.equal(r.commands[0].foreign, undefined, 'not deferred');
    assert.equal(r.commands[0].suspect.length, 1);
    assert.equal(r.commands[0].suspect[0].test, 'a_foreign');
    assert.match(r.commands[0].suspect[0].reason, /^suspect: paired pin [0-9a-f]{7} \(rapid-game 0123456\)$/);
    const lines = []; printResult(r, (l) => lines.push(l));
    assert.ok(lines.some((l) => l.includes('suspect: paired pin') && l.includes('a_foreign')));
  } finally { s.done(); }
});

test('a pin for a different ticket keeps today\'s behaviour: the failure is foreign and the job passes', () => {
  const { s, r, base } = runWithPin('T-OTHER');
  try {
    assert.equal(r.status, 'passed');
    assert.deepEqual(r.foreign.map((f) => f.test), ['a_foreign']);
    assert.equal(r.commands[0].suspect, undefined);
    assert.deepEqual(pairedPins(s.root, base, 'T-9'), []);
    assert.equal(pairedPins(s.root, base, 'T-OTHER').length, 1);
    assert.equal(pairedPins(s.root, null, 'T-OTHER').length, 0, 'no base, no pairing');
    assert.equal(g(['log', '-1', '--format=%s'], s.root).startsWith('chore: pin'), true);
  } finally { s.done(); }
});
