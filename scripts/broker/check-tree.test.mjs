// check-tree.test.mjs — check runs happen in a broker-owned git worktree (KIT-T698): the maintainer's checkout holds
// landed code only, a landing writes it after the checks passed, and `live tree:` answers whether it is patched now.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareCheckTree } from './check-tree.mjs';
import { liveLine, liveState, markLive, clearLive } from './live-patch.mjs';
import { readPhase } from './phase.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, envelope, fixture, g, snapshot } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const fwd = (p) => p.split(String.fromCharCode(92)).join('/');

// A command that records what the live file and its own cwd's file hold while it runs.
function probe(s, dir) {
  const out = fwd(join(dir, 'seen.json'));
  const live = fwd(join(s.root, 'src.txt'));
  return `node -e "const fs=require('fs');fs.writeFileSync('${out}',JSON.stringify({live:fs.readFileSync('${live}','utf8'),own:fs.readFileSync('src.txt','utf8'),cwd:process.cwd()}));fs.appendFileSync('${out}.runs','x')"`;
}

function setup() {
  const s = fixture();
  s.cfg.checkTree = true;
  const dir = tempDir('check-tree-');
  const seen = () => JSON.parse(readFileSync(join(dir, 'seen.json'), 'utf8'));
  const runs = () => (existsSync(join(dir, 'seen.json.runs')) ? readFileSync(join(dir, 'seen.json.runs'), 'utf8').length : 0);
  const submit = (flags, command) => {
    const { job } = buildPatchJob(s.cfg, flags, envelope(['beta', 'BETA']));
    writeJob(s.cfg, { ...job, commands: [command] });
    processOnce(s.cfg);
    return { job, result: readResult(s.cfg, job.id) };
  };
  return { s, dir, seen, runs, submit, command: probe(s, dir), done: () => { cleanup(dir); s.done(); } };
}

test('a check-only job applies its patch in the check tree; the live checkout is never patched', () => {
  const t = setup();
  try {
    const before = snapshot(t.s.root);
    const { result } = t.submit({ ticket: 'T-1' }, t.command);
    assert.equal(result.status, 'passed', JSON.stringify(result));
    assert.match(t.seen().live, /beta/, 'while the command ran, the live file held the original');
    assert.doesNotMatch(t.seen().live, /BETA/);
    assert.match(t.seen().own, /BETA/, 'the command saw the patch in its own tree');
    assert.match(fwd(t.seen().cwd), /target\/broker\/check\/app/, 'it ran in the check tree');
    assert.deepEqual(snapshot(t.s.root), before, 'the live checkout is byte for byte what it was');
    assert.equal(liveLine(t.s.cfg), 'live tree: landed code only');
    assert.equal(readPhase(t.s.cfg), null, 'a finished job leaves no phase behind');
  } finally { t.done(); }
});

test('a landing runs its checks in the check tree, then writes the live tree once and lands it without running again', () => {
  const t = setup();
  try {
    const { result } = t.submit({ ticket: 'T-1', title: 'beta', land: true }, t.command);
    assert.equal(result.status, 'landed', JSON.stringify(result));
    assert.match(t.seen().live, /beta/, 'the live file was still the original when the checks ran');
    assert.equal(t.runs(), 1, 'the command ran once, in the check tree, not again in the live tree');
    assert.match(readFileSync(join(t.s.root, 'src.txt'), 'utf8'), /BETA/, 'the landed code is in the live checkout');
    assert.equal(g(['log', '-1', '--pretty=%s'], t.s.root).includes('beta'), true);
    assert.equal(liveState(t.s.cfg).patched, false, 'the marker is gone once the landing finished');
  } finally { t.done(); }
});

test('a failing landing never touches the live checkout', () => {
  const t = setup();
  try {
    const before = snapshot(t.s.root);
    const head = g(['rev-parse', 'HEAD'], t.s.root);
    const { result } = t.submit({ ticket: 'T-1', land: true }, 'node -e "process.exit(1)"');
    assert.equal(result.status, 'failed');
    assert.deepEqual(snapshot(t.s.root), before);
    assert.equal(g(['rev-parse', 'HEAD'], t.s.root), head);
  } finally { t.done(); }
});

test('the check tree follows the live HEAD between jobs', () => {
  const t = setup();
  try {
    t.submit({ ticket: 'T-1' }, t.command);
    commitOnMain(t.s.root, 'src.txt', 'alpha\nbeta\ngamma\nmoved\n', 'move head');
    g(['push', 'origin', 'main'], t.s.root);
    const { job } = buildPatchJob(t.s.cfg, { ticket: 'T-2' }, envelope(['moved', 'MOVED']));
    writeJob(t.s.cfg, { ...job, commands: [t.command] });
    processOnce(t.s.cfg);
    assert.equal(readResult(t.s.cfg, job.id).status, 'passed');
    assert.match(t.seen().own, /MOVED/);
  } finally { t.done(); }
});

test('negative control: when the check tree cannot be made the job runs in the live checkout and the marker says so', () => {
  const t = setup();
  try {
    const squat = join(t.s.cfg.targetDir, 'broker', 'check', 'app');
    mkdirSync(squat, { recursive: true });
    writeFileSync(join(squat, 'in-the-way.txt'), 'x');
    assert.match(prepareCheckTree(t.s.cfg, t.s.cfg.repos[0]).error, /not empty/);
    const { result } = t.submit({ ticket: 'T-1' }, t.command);
    assert.equal(result.status, 'passed');
    assert.match(t.seen().live, /BETA/, 'the fallback patched the live file while the command ran');
    assert.equal(liveState(t.s.cfg).patched, false, 'and the marker is cleared afterwards');
  } finally { t.done(); }
});

test('the live marker names the job that has patched the live tree', () => {
  const t = setup();
  try {
    markLive(t.s.cfg, 'j-1-a', 'landing');
    assert.match(liveLine(t.s.cfg), /PATCHED by j-1-a \(landing\)/);
    clearLive(t.s.cfg);
    assert.equal(liveLine(t.s.cfg), 'live tree: landed code only');
  } finally { t.done(); }
});
