// autopin.test.mjs — one submodule landing queues one pin job in each consumer checkout's OWN broker
// (KIT-T563): the job is pin-only, no consumer waits on another, a red pin keeps the old gitlink and
// files a bug in that consumer's repo while the other consumer pins, and a stale pin is not a break.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumersOf, queueAutoPins, reportRedPin } from './autopin.mjs';
import { laneConfigs, normalizeBroker, readBrokerConfig } from './config.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, g } from './patchkit.mjs';
import { addOrigin, cleanup, makeRepo, tempDir } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const RED = 'node -e "process.exit(1)"';
const SUBMIT = join(import.meta.dirname, 'submit.mjs');

// A shared rapid-game origin and N consumer checkouts, each a Cargo superproject with its own origin
// and broker config marking rapid-game auto_pin.
function world(consumers) {
  const subDir = tempDir('ap-sub-bare-');
  const subSrc = makeRepo(tempDir('ap-sub-src-'));
  const subBare = addOrigin(subSrc, join(subDir, 'sub.git')).split(String.fromCharCode(92)).join('/');
  const cleanups = [subDir, subSrc];
  const roots = consumers.map(({ verify, autoPin = true }) => {
    const root = makeRepo(tempDir('ap-consumer-'));
    const superDir = tempDir('ap-super-bare-');
    const superBare = addOrigin(root, join(superDir, 'super.git'));
    writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nmembers = []\n');
    g(['add', '-A'], root);
    g(['commit', '-m', 'workspace'], root);
    g(['-c', 'protocol.file.allow=always', 'submodule', 'add', subBare, 'rapid-game'], root);
    g(['commit', '-m', 'add submodule'], root);
    g(['push', 'origin', 'main'], root);
    const sub = join(root, 'rapid-game');
    g(['checkout', 'main'], sub);
    for (const [k, v] of [['user.email', 'b@test'], ['user.name', 'B'], ['commit.gpgsign', 'false']]) g(['config', k, v], sub);
    mkdirSync(join(root, '.ai'), { recursive: true });
    writeFileSync(join(root, '.ai', 'config.yml'), `broker:\n  verify_default:\n    - ${verify}\n  repos:\n    - { name: stiletto, path: ., main: main, remote: origin }\n    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: .${autoPin ? ', auto_pin: true' : ''} }\n`);
    cleanups.push(root, superDir);
    return { root, sub, superBare, cfg: readBrokerConfig(root) };
  });
  return { subBare, roots, done: () => cleanups.forEach(cleanup) };
}

test('a rapid-game lane landing queues a pin job in every registered consumer, whichever checkout landed it', async () => {
  const w = world([{ verify: PASS }, { verify: PASS }]);
  const regDir = tempDir('ap-registry-');
  const was = { registry: process.env.CLAUDE_KIT_REGISTRY, off: process.env.BROKER_NO_AUTOPIN };
  try {
    writeFileSync(join(regDir, 'registry.json'), JSON.stringify({ projects: { one: w.roots[0].root, two: w.roots[1].root } }));
    process.env.CLAUDE_KIT_REGISTRY = join(regDir, 'registry.json');
    delete process.env.BROKER_NO_AUTOPIN;
    const [, subLane] = laneConfigs(w.roots[0].cfg);
    const { job } = buildPatchJob(w.roots[0].cfg, { repo: 'rapid-game', ticket: 'RG-T5', title: 'framework', land: true, 'no-pin': true }, '*** write api.txt\napi\n');
    writeJob(subLane, { ...job, commands: [PASS] });
    processOnce(subLane);
    const end = Date.now() + 120_000;
    while (w.roots.some((r) => listQueue(r.cfg).length === 0) && Date.now() < end) await new Promise((r) => setTimeout(r, 200));
    for (const r of w.roots) {
      const jobs = listQueue(r.cfg);
      assert.equal(jobs.length, 1, r.root);
      assert.equal(jobs[0].autoPin, job.id);
      assert.equal(jobs[0].pins[0].sha, g(['--git-dir', w.subBare, 'rev-parse', 'main'], r.root), 'pins the sha that reached the remote');
    }
  } finally {
    for (const [k, v] of [['CLAUDE_KIT_REGISTRY', was.registry], ['BROKER_NO_AUTOPIN', was.off]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    cleanup(regDir);
    w.done();
  }
});

const spawnSubmit = (file, args) => {
  const r = spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', input: '', windowsHide: true, env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
  if (r.status !== 0) throw new Error(`submit failed: ${r.stderr}`);
};

// A new rapid-game commit on the shared origin, made from the first consumer's submodule.
function landInFramework(w) {
  const sub = w.roots[0].sub;
  commitOnMain(sub, 'api.txt', 'new api\n', 'framework change');
  g(['push', 'origin', 'main'], sub);
  return g(['rev-parse', 'HEAD'], sub);
}

test('one submodule landing queues one pin-only job per consumer, each in its own queue, and a red consumer leaves the other pinned', () => {
  const w = world([{ verify: RED }, { verify: PASS }]);
  try {
    const sha = landInFramework(w);
    const repo = w.roots[0].cfg.repos[1];
    const queued = queueAutoPins(repo, sha, [{ id: 'j-origin', ticket: 'RG-T9' }], { consumers: w.roots.map((r) => r.root), run: spawnSubmit });
    assert.deepEqual(queued, w.roots.map((r) => r.root));
    for (const { cfg } of w.roots) {
      const jobs = listQueue(cfg);
      assert.equal(jobs.length, 1, 'one pin job in its own queue');
      assert.deepEqual([jobs[0].ops, jobs[0].land, jobs[0].autoPin, jobs[0].pins.map((p) => [p.repo, p.sha])], [[], true, 'j-origin', [['rapid-game', sha]]]);
    }

    const [red, green] = w.roots;
    const oldPin = g(['rev-parse', 'HEAD:rapid-game'], red.root);
    const bugs = [];
    const redRun = processOnce(red.cfg, { fileBug: (b) => bugs.push(b) });
    assert.equal(redRun.processed[0].status, 'failed', JSON.stringify(redRun.processed[0]));
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], red.root), oldPin, 'a red pin keeps the old gitlink');
    assert.equal(bugs.length, 1);
    assert.equal(bugs[0].cwd, red.root, 'the bug is filed in the consumer\'s own repo');
    assert.match(bugs[0].text, /auto-pin of rapid-game .* is failed here/);

    const greenRun = processOnce(green.cfg, { fileBug: (b) => bugs.push(b) });
    assert.equal(greenRun.processed[0].status, 'landed', JSON.stringify(greenRun.processed[0]));
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], green.root), sha, 'the green consumer pinned');
    assert.equal(g(['--git-dir', green.superBare, 'rev-parse', 'main'], green.root), g(['rev-parse', 'HEAD'], green.root), 'and pushed through its own broker');
    assert.equal(bugs.length, 1, 'no bug for the green consumer');
  } finally { w.done(); }
});

test('consumersOf: only registered checkouts that mark the submodule auto_pin, share its remote, and are not scratch', () => {
  const w = world([{ verify: PASS }, { verify: PASS, autoPin: false }]);
  try {
    const repo = w.roots[0].cfg.repos[1];
    const projects = { a: w.roots[0].root, off: w.roots[1].root, ghost: join(w.roots[0].root, 'missing'), dup: w.roots[0].root };
    const none = /^$/;
    assert.deepEqual(consumersOf(repo, { projects, scratch: none }), [w.roots[0].root]);
    assert.deepEqual(consumersOf(repo, { projects, scratch: none, from: 'file:///elsewhere' }), [], 'a different remote is not this submodule');
    const worktree = join(w.roots[0].root, '.claude', 'worktrees', 'w');
    assert.deepEqual(consumersOf(repo, { projects: { wt: worktree } }), [], 'an agent worktree is not a consumer');
  } finally { w.done(); }
});

test('reportRedPin: a stale or landed pin files nothing, a job that is not an auto-pin files nothing', () => {
  const bugs = [];
  const fileBug = (b) => bugs.push(b);
  const cfg = { root: '/r' };
  const job = { id: 'j-1', autoPin: 'j-0', pins: [{ repo: 'rapid-game', sha: 'a'.repeat(40) }] };
  assert.equal(reportRedPin(cfg, job, { status: 'stale', phase: 'pin' }, { fileBug }), false);
  assert.equal(reportRedPin(cfg, job, { status: 'landed', phase: 'land' }, { fileBug }), false);
  assert.equal(reportRedPin(cfg, { ...job, autoPin: null }, { status: 'failed', phase: 'run' }, { fileBug }), false);
  assert.deepEqual(bugs, []);
  reportRedPin(cfg, job, { status: 'failed', phase: 'run', commands: [{ cmd: 'cargo t', exit: 101 }] }, { fileBug });
  assert.match(bugs[0].text, /`cargo t` exited 101/);
  assert.equal(normalizeBroker('/r', { repos: [{ name: 'x', path: 'x', submodule: true, auto_pin: true }] }).repos[0].autoPin, true);
});
