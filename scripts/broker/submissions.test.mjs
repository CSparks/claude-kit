// submissions.mjs + finished-ack.mjs + finished-log.mjs reader (KIT-T822): a submit leaves a ledger row and a kept copy,
// a kept copy queues again under a new id, the finished log parses back, and an ack by agent covers that agent only.
// Run: node scripts/broker/submissions.test.mjs

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ackAgent, readAcks } from './finished-ack.mjs';
import { recordFinished, readFinished } from './finished-log.mjs';
import { readSubmissions, recordSubmission, resubmitJob, submittedJob } from './submissions.mjs';

const AGENT = 'a1b2c3d4e5f6a7b8c';
const OTHER = 'ffeeddccbbaa99887';

function withDir(fn) {
  const targetDir = mkdtempSync(join(tmpdir(), 'kit-subm-'));
  try { fn({ targetDir }, join(targetDir, 'broker')); } finally { rmSync(targetDir, { recursive: true, force: true }); }
}

test('a submit leaves a ledger row naming job, agent and ticket, and a kept copy of the job', () => {
  withDir((cfg, dir) => {
    recordSubmission(cfg, { id: 'j-1', agent: AGENT, ticket: 'KIT-T1', repo: 'r', commands: ['x'] });
    assert.deepEqual(readSubmissions(dir).map((r) => [r.id, r.agent, r.ticket]), [['j-1', AGENT, 'KIT-T1']]);
    assert.equal(submittedJob(dir, 'j-1').commands[0], 'x');
    assert.equal(submittedJob(dir, 'j-none'), null);
  });
});

test('a kept copy queues again under a new id; an unknown id returns null', () => {
  withDir((cfg, dir) => {
    recordSubmission(cfg, { id: 'j-1', agent: AGENT, ticket: 'KIT-T1', repo: 'r' });
    const again = resubmitJob(cfg, 'j-1');
    assert.notEqual(again.id, 'j-1');
    assert.equal(again.resubmitOf, 'j-1');
    assert.ok(existsSync(join(dir, 'queue', `${again.id}.json`)));
    assert.equal(resubmitJob(cfg, 'j-nope'), null);
  });
});

test('the finished log parses back and an ack by agent covers that agent only', () => {
  withDir((cfg, dir) => {
    recordFinished(cfg, { id: 'j-1', status: 'landed', agent: AGENT, ticket: 'KIT-T1', landed: { sha: 'abc123' } });
    recordFinished(cfg, { id: 'j-2', status: 'passed', agent: OTHER, ticket: 'KIT-T2' });
    recordFinished(cfg, { id: 'j-3', status: 'passed' });
    const lines = readFinished(dir);
    assert.deepEqual(lines.map((l) => [l.job, l.verdict, l.agent, l.ticket, l.landed]), [['j-1', 'landed', AGENT, 'KIT-T1', 'abc123'], ['j-2', 'passed', OTHER, 'KIT-T2', null], ['j-3', 'passed', null, null, null]]);
    assert.deepEqual(ackAgent(dir, AGENT), ['j-1']);
    assert.deepEqual([...readAcks(dir)], ['j-1']);
    assert.deepEqual(ackAgent(dir, AGENT), []);
  });
});
