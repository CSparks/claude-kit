// precheck guards (KIT-D115 follow-up): a touched script must parse, and a cold precheck target never builds beside a running job.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { precheckJob } from './precheck.mjs';
import { scriptSyntaxFailures } from './syntax-check.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture } from './patchkit.mjs';

const PASSES = String.raw`node -e "process.exit(0)"`;
const GOOD_SCRIPT = 'export const answer = () => 1 + 1;\n';
const BROKEN_SCRIPT = 'export const answer = () => { return (1 + ;\n';

function setup(files, extra = {}) {
  const s = fixture();
  const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check: PASSES }, ...extra };
  const body = Object.entries(files).map(([path, text]) => `*** write ${path}\n${text}`).join('');
  const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1', measure: false }, body);
  return { s, cfg, job, repo: cfg.repos[0] };
}

const spy = () => {
  const calls = [];
  const run = (cmd) => { calls.push(cmd); return { cmd, exit: 0, durationMs: 1, logTail: [], cancelled: false }; };
  return { calls, run };
};

test('a touched .mjs with a syntax error is rejected at submit, naming the file; nothing is queued', () => {
  const { s, cfg, job, repo } = setup({ 'tools/split.mjs': BROKEN_SCRIPT });
  try {
    const rejected = precheckJob(cfg, job, repo);
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.phase, 'precheck');
    assert.match(rejected.message, /syntax error in tools\/split\.mjs/);
    assert.match(rejected.message, /never entered the queue/);
    assert.deepEqual(Object.keys(rejected.commands[0].errors), ['tools/split.mjs']);
    assert.match(rejected.commands[0].cmd, /node --check tools\/split\.mjs/);
  } finally { s.done(); }
});

test('negative control: a valid script, a non-script file with the same text, and a script the patch did not touch all queue', () => {
  const ok = setup({ 'tools/split.mjs': GOOD_SCRIPT });
  const notAScript = setup({ 'notes.txt': BROKEN_SCRIPT });
  try {
    assert.equal(precheckJob(ok.cfg, ok.job, ok.repo), null, 'valid script');
    assert.equal(precheckJob(notAScript.cfg, notAScript.job, notAScript.repo), null, 'text file is not judged');
    const untouched = scriptSyntaxFailures(ok.s.root, new Map([['notes.txt', { text: BROKEN_SCRIPT }], ['gone.mjs', { text: null }]]));
    assert.deepEqual(untouched, [], 'a deleted script and a non-script are not checked');
  } finally { ok.s.done(); notAScript.s.done(); }
});

test('the syntax check needs no cargo: with no compile check configured a broken script is still rejected', () => {
  const { s, cfg, job, repo } = setup({ 'tools/split.mjs': BROKEN_SCRIPT }, { affected: { check: null } });
  try { assert.equal(precheckJob(cfg, job, repo).phase, 'precheck'); } finally { s.done(); }
});

test('a cold precheck target does not build while a lane is busy; the job queues unchecked', () => {
  const { s, cfg, job, repo } = setup({ 'notes.txt': 'x\n' });
  const { calls, run } = spy();
  try {
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => 'lane root is running j-1' }), null);
    assert.deepEqual(calls, [], 'cargo check did not start');
  } finally { s.done(); }
});

test('control: a cold target builds while every lane is idle and is then warm, so it also runs beside a running job', () => {
  const { s, cfg, job, repo } = setup({ 'notes.txt': 'x\n' });
  const { calls, run } = spy();
  try {
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => null }), null);
    assert.equal(calls.length, 1, 'idle: the cold build ran');
    assert.equal(existsSync(join(cfg.targetDir, 'broker', 'precheck-app.warm')), true, 'a finished run marks the target warm');
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => 'lane root is running j-1' }), null);
    assert.equal(calls.length, 2, 'warm: it runs beside the job');
  } finally { s.done(); }
});

test('a patch that touches only markdown never starts a cargo check; control: one source file alongside it does', () => {
  const docs = setup({ 'docs/NOTES.md': '# notes\n' });
  const mixed = setup({ 'docs/NOTES.md': '# notes\n', 'notes.txt': 'x\n' });
  try {
    const only = spy();
    assert.equal(precheckJob(docs.cfg, docs.job, docs.repo, { run: only.run, busy: () => null }), null);
    assert.deepEqual(only.calls, [], 'no cargo check for a docs-only patch');
    const both = spy();
    assert.equal(precheckJob(mixed.cfg, mixed.job, mixed.repo, { run: both.run, busy: () => null }), null);
    assert.equal(both.calls.length, 1);
  } finally { docs.s.done(); mixed.s.done(); }
});

test('control: a run that timed out leaves the target cold', () => {
  const { s, cfg, job, repo } = setup({ 'notes.txt': 'x\n' });
  try {
    const run = (cmd) => ({ cmd, exit: 1, durationMs: 1, logTail: [], timedOut: true });
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => null }), null);
    assert.equal(existsSync(join(cfg.targetDir, 'broker', 'precheck-app.warm')), false);
  } finally { s.done(); }
});
