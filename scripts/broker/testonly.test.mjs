// testonly.test.mjs — `submit --no-patch` queues a test-only job: the --test commands run on HEAD,
// check-only, and a landing with no operations is refused (KIT-T317).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, snapshot } from './patchkit.mjs';

const SUBMIT = join(import.meta.dirname, 'submit.mjs');
const submit = (s, args, input = '') => spawnSync(process.execPath, [SUBMIT, '--root', s.root, ...args], { input, encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
const FAIL_ONE = `node -e "console.log('test t_main ... FAILED');process.exit(1)"`;
const SEE_HEAD = `node -e "process.stdout.write(require('fs').readFileSync('src.txt','utf8'))"`;

test('a test-only job runs its --test commands on HEAD and leaves the tree and history alone', () => {
  const s = fixture();
  try {
    const before = snapshot(s.root);
    const head = g(['rev-parse', 'HEAD'], s.root);
    const { job, error } = buildPatchJob(s.cfg, { 'no-patch': true }, '');
    assert.equal(error, undefined);
    assert.deepEqual(job.ops, []);
    writeJob(s.cfg, { ...job, commands: [SEE_HEAD] });
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.equal(r.commands.length, 1);
    assert.match(r.commands[0].logTail.join('\n'), /alpha/);
    assert.deepEqual(snapshot(s.root), before);
    assert.equal(g(['rev-parse', 'HEAD'], s.root), head);
  } finally { s.done(); }
});

test('a failing test on HEAD is reported like any job', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, { 'no-patch': true }, '');
    writeJob(s.cfg, { ...job, commands: [FAIL_ONE] });
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.equal(r.commands[0].exit, 1);
  } finally { s.done(); }
});

test('--land with no operations is refused at submit and again by the broker', () => {
  const s = fixture();
  try {
    assert.match(buildPatchJob(s.cfg, { 'no-patch': true, land: true, ticket: 'T-1' }, '').error, /cannot --land/);
    const cli = submit(s, ['--no-patch', '--land', '--ticket', 'T-1']);
    assert.equal(cli.status, 2, cli.stderr);
    const { job } = buildPatchJob(s.cfg, { 'no-patch': true }, '');
    writeJob(s.cfg, { ...job, land: true, ticket: 'T-1', commands: [SEE_HEAD] });
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.match(r.message, /cannot --land/);
  } finally { s.done(); }
});

test('negative: without --no-patch an empty envelope is still refused, and the CLI flag queues a job', () => {
  const s = fixture();
  try {
    assert.match(buildPatchJob(s.cfg, {}, '').error, /no operations/);
    const cli = submit(s, ['--no-patch', '--test', SEE_HEAD]);
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout.trim(), /^j-/);
    assert.equal(submit(s, [], '').status, 2, 'an empty stdin envelope without the flag fails');
  } finally { s.done(); }
});
