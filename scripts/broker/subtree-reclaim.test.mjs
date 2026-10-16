// subtree-reclaim.test.mjs — a dead lane's tree is not free while its commands live, and a restore
// writes only under the tree lock, in the checkout's own line endings (KIT-T552). The lane holder
// is a second process killed mid-command; the other lane and the replacement daemon are this
// process and a spawned broker. Controls: a live holder's command is not touched, an unrelated
// journalled file keeps its exact bytes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths, laneConfigs, repoByName } from './config.mjs';
import { capture, restore } from './preimage.mjs';
import { ensureDirs } from './result.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { takeSubtrees } from './subtree.mjs';
import { takeOverJournal } from './takeover.mjs';
import { tempDir } from './testkit.mjs';

const DRIVE = join(import.meta.dirname, 'subtree-drive.mjs');
const BROKER = join(import.meta.dirname, 'broker.mjs');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fixture() {
  const t = setup();
  const cfgFile = join(tempDir('reclaim-cfg-'), 'cfg.json');
  writeFileSync(cfgFile, JSON.stringify({ root: t.root, broker: t.broker }));
  mkdirSync(join(t.root, '.ai'), { recursive: true });
  writeFileSync(join(t.root, '.ai', 'config.yml'), [
    'broker:',
    '  repos:',
    '    - { name: super, path: ., main: main, remote: origin }',
    '    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }',
    '',
  ].join('\n'));
  const [rootLane, subLane] = laneConfigs(t.cfg);
  ensureDirs(subLane);
  return { ...t, cfgFile, rootLane, subLane, rg: repoByName(t.cfg, 'rapid-game') };
}

// The rapid-game lane's daemon took its tree, started a gate command and died without releasing.
function killedMidGate(t) {
  const r = spawnSync(process.execPath, [DRIVE, 'hold', t.cfgFile, 'rapid-game'], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  const pid = Number(/child=(\d+)/.exec(r.stdout)[1]);
  assert.ok(alive(pid), 'the gate command outlived its daemon');
  return pid;
}

test('the other lane does not take a dead holder\'s tree while its command tree lives: reclaim ends it first', () => {
  const t = fixture();
  let pid = 0;
  try {
    pid = killedMidGate(t);
    const got = takeSubtrees(t.rootLane, [t.rg], 'j-root');
    assert.ok(got.ok, 'the dead holder\'s lock is reclaimed');
    assert.equal(alive(pid), false, 'but only once the command tree it left running is gone');
    got.release();
  } finally {
    if (pid && alive(pid)) { try { process.kill(pid); } catch { /* gone */ } }
    t.done();
  }
});

test('control: a live holder keeps the tree and its command is left running', () => {
  const t = fixture();
  let child;
  try {
    const held = takeSubtrees(t.subLane, [t.rg], 'j-lane');
    assert.ok(held.ok);
    child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    writeFileSync(join(brokerPaths(t.subLane).home, 'children.json'), JSON.stringify([{ pid: child.pid, daemon: process.pid, host: hostname(), marker: join(brokerPaths(t.subLane).home, 'none.exit'), logPath: null, cmd: 'gate' }]));
    const blocked = takeSubtrees(t.rootLane, [t.rg], 'j-root');
    assert.equal(blocked.ok, false);
    assert.ok(alive(child.pid), 'a live daemon\'s command is not ended');
    held.release();
  } finally {
    if (child && alive(child.pid)) { try { process.kill(child.pid); } catch { /* gone */ } }
    t.done();
  }
});

test('a replacement lane daemon restores its journal only once it holds the tree, then restores', async () => {
  const t = fixture();
  try {
    const readme = join(t.sub, 'README');
    const before = readFileSync(readme, 'utf8');
    capture(t.subLane, { id: 'train-x', cwd: t.sub, paths: ['README'] });
    writeFileSync(readme, 'half applied\n');
    const rootHolds = takeSubtrees(t.rootLane, [t.rg], 'j-root');
    assert.ok(rootHolds.ok);
    const run = () => spawnSync(process.execPath, [BROKER, '--root', t.root, '--lane', 'rapid-game', '--once'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    const waiting = run();
    assert.equal(waiting.status, 0, waiting.stderr);
    assert.equal(readFileSync(readme, 'utf8'), 'half applied\n', 'nothing is written into the tree the root lane holds');
    assert.match(waiting.stderr, /restore of train-x waits: rapid-game tree held by lane root/);
    rootHolds.release();
    await sleep(100);
    const restored = run();
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(readFileSync(readme, 'utf8'), before);
    assert.match(restored.stderr, /restored the tree after interrupted job train-x/);
  } finally { t.done(); }
});

// A tracked file with LF blob content and a CRLF working copy, the way an autocrlf=true checkout writes it.
function crlfRepo(t) {
  g(['config', 'core.autocrlf', 'true'], t.sub);
  writeFileSync(join(t.sub, 'crlf.txt'), 'one\ntwo\n');
  g(['add', 'crlf.txt'], t.sub);
  g(['commit', '-q', '-m', 'add crlf.txt'], t.sub);
  writeFileSync(join(t.sub, 'crlf.txt'), 'scratch\n');
  g(['checkout', '--', 'crlf.txt'], t.sub);
  return readFileSync(join(t.sub, 'crlf.txt'));
}

test('a restored tracked file is byte-identical to a git checkout of the same blob on an autocrlf checkout', () => {
  const t = fixture();
  try {
    const checkedOut = crlfRepo(t);
    assert.ok(checkedOut.includes(Buffer.from('\r\n')), 'the fixture checkout is CRLF');
    writeFileSync(join(t.sub, 'crlf.txt'), 'one\ntwo\n');
    const journal = capture(t.subLane, { id: 'train-x', cwd: t.sub, paths: ['crlf.txt'] });
    writeFileSync(join(t.sub, 'crlf.txt'), 'overwritten\n');
    restore(t.subLane, journal);
    assert.deepEqual(readFileSync(join(t.sub, 'crlf.txt')), checkedOut);
    assert.equal(g(['status', '--porcelain'], t.sub), '', 'git sees no change');
  } finally { t.done(); }
});

test('control: journalled content that differs from the tracked file keeps its exact bytes', () => {
  const t = fixture();
  try {
    crlfRepo(t);
    const mine = Buffer.from('my own edit\nline two\n');
    writeFileSync(join(t.sub, 'crlf.txt'), mine);
    const journal = capture(t.subLane, { id: 'train-x', cwd: t.sub, paths: ['crlf.txt'] });
    writeFileSync(join(t.sub, 'crlf.txt'), 'overwritten\n');
    restore(t.subLane, journal);
    assert.deepEqual(readFileSync(join(t.sub, 'crlf.txt')), mine);
    assert.ok(existsSync(join(t.sub, 'crlf.txt')));
  } finally { t.done(); }
});

test('a job taking over a dead daemon\'s journal waits while the other lane holds the tree it restores into', () => {
  const t = fixture();
  try {
    const readme = join(t.sub, 'README');
    const before = readFileSync(readme, 'utf8');
    capture(t.rootLane, { id: 'j-1', cwd: t.sub, paths: ['README'] });
    writeFileSync(readme, 'half applied\n');
    const rootHolds = takeSubtrees(t.rootLane, [t.rg], 'j-root');
    assert.ok(rootHolds.ok);
    const busy = takeOverJournal(t.subLane, 'j-1');
    assert.match(busy.busy, /rapid-game tree held by lane root/);
    assert.equal(readFileSync(readme, 'utf8'), 'half applied\n');
    rootHolds.release();
    const taken = takeOverJournal(t.subLane, 'j-1');
    assert.deepEqual(taken.restored, ['README']);
    assert.equal(readFileSync(readme, 'utf8'), before);
  } finally { t.done(); }
});
