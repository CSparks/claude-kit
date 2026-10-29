// agent.mjs + finished-log.mjs (KIT-D115): a subagent may not follow the checkout or wait past 5 minutes, a submit never
// waits, the job and its result carry the submitting agent, and every final result writes one line the orchestrator watches.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentOf, subagentRefusal } from './agent.mjs';
import { FINISHED_LOG, finishedLine } from './finished-log.mjs';
import { envelope, fixture } from './patchkit.mjs';
import { STATUS, readResult, writeJob, writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';

const SCRIPTS = import.meta.dirname;
const run = (script, ...args) => spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_AGENT_ID: '' } });

test('agentOf reads --agent first, then the environment; the orchestrator has none', () => {
  assert.equal(agentOf({ agent: 'a1' }, { CLAUDE_KIT_AGENT_ID: 'e1' }), 'a1');
  assert.equal(agentOf({}, { CLAUDE_KIT_AGENT_ID: 'e1' }), 'e1');
  assert.equal(agentOf({}, {}), null);
  assert.equal(agentOf({ agent: true }, {}), null);
});

test('a subagent: watch refused, wait over 300 s refused, submit --wait refused; one bounded wait passes', () => {
  assert.match(subagentRefusal('watch', { agent: 'a1' }, {}), /orchestrator's/);
  assert.match(subagentRefusal('wait', { agent: 'a1', timeout: '540' }, {}), /under 5 minutes/);
  assert.match(subagentRefusal('submit', { agent: 'a1', wait: true }, {}), /submit never waits/);
  assert.equal(subagentRefusal('wait', { agent: 'a1', timeout: '280' }, {}), null, 'control: the one bounded wait');
  assert.equal(subagentRefusal('wait', { agent: 'a1', timeout: '300' }, {}), null, 'control: the limit itself');
  assert.equal(subagentRefusal('wait', { agent: 'a1' }, {}), null, 'control: the default timeout');
  assert.equal(subagentRefusal('submit', { agent: 'a1' }, {}), null, 'control: a plain submit');
});

test('negative: the orchestrator may watch and wait long', () => {
  assert.equal(subagentRefusal('watch', {}, {}), null);
  assert.equal(subagentRefusal('wait', { timeout: '900' }, {}), null);
});

test('the CLIs refuse by themselves, so a pipe, a grep or a background shell around them gets nowhere', () => {
  const watch = run('watch.mjs', '--agent', 'a1', '--for', 'any');
  assert.equal(watch.status, 2);
  assert.match(watch.stderr, /handoff/);
  const wait = run('wait.mjs', 'j-1-a', '--agent', 'a1', '--timeout', '540');
  assert.equal(wait.status, 2);
  assert.match(wait.stderr, /under 5 minutes/);
  const submit = run('submit.mjs', '--agent', 'a1', '--wait', '--no-patch');
  assert.equal(submit.status, 2);
  assert.match(submit.stderr, /never waits/);
  assert.equal(run('submit.mjs', '--wait', '--no-patch').status, 2, 'submit has no wait for anyone');
});

test('the job carries the submitting agent and its result and finished line name it', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, { agent: 'a1b2c3', ticket: 'KIT-T1' }, envelope(['beta', 'BETA']));
    assert.equal(job.agent, 'a1b2c3');
    assert.equal(buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA'])).job.agent, undefined, 'control: the orchestrator sets none');
    writeJob(s.cfg, job);
    const result = writeResult(s.cfg, { id: job.id, repo: 'app', ticket: 'KIT-T1', status: STATUS.PASSED, commands: [] });
    assert.equal(result.agent, 'a1b2c3');
    assert.equal(readResult(s.cfg, job.id).agent, 'a1b2c3');
    const log = readFileSync(join(s.cfg.targetDir, 'broker', FINISHED_LOG), 'utf8').trim().split('\n');
    assert.equal(log.length, 1);
    assert.match(log[0], new RegExp(`^\\S+ ${job.id} passed agent=a1b2c3 ticket=KIT-T1$`));
  } finally { s.done(); }
});

test('a landed result adds the sha; an orchestrator job names no agent; a dirty hold writes no line', () => {
  const s = fixture();
  try {
    writeResult(s.cfg, { id: 'j-1-landed', repo: 'app', ticket: 'KIT-T2', status: STATUS.LANDED, landed: { sha: 'abc1234' }, commands: [] });
    writeResult(s.cfg, { id: 'j-2-dirty', repo: 'app', status: STATUS.DIRTY, commands: [] });
    const lines = readFileSync(join(s.cfg.targetDir, 'broker', FINISHED_LOG), 'utf8').trim().split('\n');
    assert.equal(lines.length, 1, 'the dirty hold is not a finished job');
    assert.match(lines[0], / j-1-landed landed agent=- ticket=KIT-T2 landed=abc1234$/);
    assert.equal(finishedLine({ id: 'j-3', status: STATUS.DIRTY }), null);
    assert.equal(existsSync(join(s.cfg.targetDir, 'broker', FINISHED_LOG)), true);
  } finally { s.done(); }
});
