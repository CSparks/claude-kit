// submit-refusal.test.mjs — a patch that cannot apply is refused at submit with no job id (KIT-T503): create-exists, a SEARCH
// that is not found, and a byte-identical envelope that already came back stale on the same base. Valid envelopes still queue.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { envelope, fixture, commitOnMain, trackCargo, g } from './patchkit.mjs';
import { REPEAT_PHASE, STATUS, ensureDirs, writeJob, writeResult } from './result.mjs';
import { buildPatchJob, refusalLines } from './submit-lib.mjs';
import { priorStale } from './stale-envelope.mjs';

const SUBMIT = join(import.meta.dirname, 'submit.mjs');
const CREATE_EXISTING = '*** write src.txt\nreplacement\n';

function runSubmit(s, text) {
  const queue = brokerPaths(s.cfg).queue;
  const run = spawnSync(process.execPath, [SUBMIT, '--root', s.root], { input: text, encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
  return { run, queued: existsSync(queue) ? readdirSync(queue).filter((f) => f.endsWith('.json')) : [] };
}

test('create-exists is refused at submit: exit 1, no job id, op index + path + reason + hint printed', () => {
  const s = trackCargo(fixture());
  try {
    const { run, queued } = runSubmit(s, CREATE_EXISTING);
    assert.equal(run.status, 1, run.stderr);
    assert.deepEqual(queued, []);
    assert.match(run.stderr, /submit: op 0 src\.txt: create-exists \(.*edit the existing file with SEARCH\/REPLACE/);
    assert.equal(JSON.parse(run.stdout).status, STATUS.STALE);
  } finally { s.done(); }
});

test('a SEARCH that does not match and an edit of a missing file are refused with a reason and a fix hint', () => {
  const s = fixture();
  try {
    const miss = buildPatchJob(s.cfg, {}, envelope(['not in the file', 'x']));
    assert.equal(miss.job, undefined);
    assert.equal(miss.result.stale[0].reason, 'not-found');
    assert.match(refusalLines(miss.result)[0], /op 0 src\.txt: not-found \(.*copy the lines exactly/);
    const gone = buildPatchJob(s.cfg, {}, '*** edit nowhere.txt\n<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n');
    assert.equal(gone.result.stale[0].reason, 'not-found');
    assert.equal(gone.result.stale[0].path, 'nowhere.txt');
  } finally { s.done(); }
});

test('negative control: a valid edit still queues and carries its envelope hash', () => {
  const s = fixture();
  try {
    const ok = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    assert.ok(ok.job, JSON.stringify(ok.result));
    assert.match(ok.job.envelope, /^[0-9a-f]{64}$/);
  } finally { s.done(); }
});

// The daemon found the queued job stale (phase apply); the ledger remembers its envelope on that base.
function daemonStale(s, text) {
  const { job } = buildPatchJob(s.cfg, {}, text);
  writeJob(s.cfg, job);
  writeResult(s.cfg, { id: job.id, base: job.base, head: job.base, status: STATUS.STALE, phase: 'apply', stale: [{ index: 0, path: 'src.txt', reason: 'not-found' }], gate: [], commands: [], landed: null });
  return job;
}

test('a byte-identical envelope that came back stale on the same base is refused at submit, naming the earlier job', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const text = envelope(['beta', 'BETA']);
    const first = daemonStale(s, text);
    assert.equal(priorStale(s.cfg, first.envelope, first.base).id, first.id);
    const again = buildPatchJob(s.cfg, {}, text);
    assert.equal(again.job, undefined);
    assert.equal(again.result.phase, REPEAT_PHASE);
    assert.equal(again.result.status, STATUS.STALE);
    assert.match(refusalLines(again.result)[0], new RegExp(`came back stale on this base as ${first.id}`));
  } finally { s.done(); }
});

test('negative controls: another envelope, or the same envelope on a moved base, still queues', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const text = envelope(['beta', 'BETA']);
    daemonStale(s, text);
    assert.ok(buildPatchJob(s.cfg, {}, envelope(['gamma', 'GAMMA'])).job, 'a different envelope queues');
    commitOnMain(s.root, 'other.txt', 'moved\n', 'move the base');
    g(['push', 'origin', 'main'], s.root);
    assert.ok(buildPatchJob(s.cfg, {}, text).job, 'the same envelope on a new base queues');
  } finally { s.done(); }
});
