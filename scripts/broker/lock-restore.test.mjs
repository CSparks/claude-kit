// lock-restore.test.mjs — every Cargo.lock a check-only run rewrites is put back byte for byte,
// including after a daemon killed mid-run and including a lock inside a submodule (KIT-T519).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { recoverInflight } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, envelope, fixture, g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { tempDir } from './testkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const LOCK = '# lock\nversion = 3\n';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rewrite = (rel) => `node -e "require('fs').appendFileSync('${rel}','# cargo rewrote this\\n')"`;
const read = (...parts) => readFileSync(join(...parts), 'utf8');

function runJob(cfg, commands, env = envelope(['beta', 'BETA'])) {
  const { job } = buildPatchJob(cfg, { ticket: 'T-1' }, env);
  writeJob(cfg, { ...job, commands });
  processOnce(cfg);
  return readResult(cfg, job.id);
}

const withLock = (rel) => {
  const s = fixture();
  mkdirSync(join(s.root, rel, '..'), { recursive: true });
  commitOnMain(s.root, rel, LOCK, 'add lock');
  g(['push', 'origin', 'main'], s.root);
  return s;
};

test('a check-only run that rewrites a tracked Cargo.lock leaves it byte-identical', () => {
  const s = withLock('Cargo.lock');
  try {
    const r = runJob(s.cfg, [rewrite('Cargo.lock')]);
    assert.equal(r.status, 'passed', JSON.stringify(r.commands));
    assert.equal(read(s.root, 'Cargo.lock'), LOCK);
    assert.equal(g(['status', '--porcelain', '--untracked-files=no'], s.root), '');
  } finally { s.done(); }
});

test('a nested lock is restored and a lock the run created is removed', () => {
  const s = withLock('crates/x/Cargo.lock');
  try {
    const r = runJob(s.cfg, [rewrite('crates/x/Cargo.lock'), rewrite('Cargo.lock')]);
    assert.equal(r.status, 'passed', JSON.stringify(r.commands));
    assert.equal(read(s.root, 'crates/x/Cargo.lock'), LOCK);
    assert.equal(existsSync(join(s.root, 'Cargo.lock')), false);
  } finally { s.done(); }
});

const hasCargo = spawnSync('cargo', ['--version'], { shell: true }).status === 0;
test('real cargo: a version bump rewrites the lock during `cargo check`, and the restore puts it back', { skip: !hasCargo }, () => {
  const s = fixture();
  try {
    const manifest = (v) => `[package]\nname = "locked"\nversion = "${v}"\nedition = "2021"\n`;
    mkdirSync(join(s.root, 'src'));
    writeFileSync(join(s.root, 'Cargo.toml'), manifest('0.1.0'));
    writeFileSync(join(s.root, 'src', 'lib.rs'), 'pub fn f() {}\n');
    g(['add', '-A'], s.root);
    g(['commit', '-m', 'crate'], s.root);
    const lock = spawnSync('cargo', ['generate-lockfile', '--offline'], { cwd: s.root, shell: true });
    assert.equal(lock.status, 0, String(lock.stderr));
    g(['add', 'Cargo.lock'], s.root);
    g(['commit', '-m', 'lock'], s.root);
    g(['push', 'origin', 'main'], s.root);
    const before = read(s.root, 'Cargo.lock');
    const r = runJob(s.cfg, ['cargo check --offline'], `*** edit Cargo.toml\n<<<<<<< SEARCH\nversion = "0.1.0"\n=======\nversion = "0.2.0"\n>>>>>>> REPLACE\n`);
    assert.equal(r.status, 'passed', JSON.stringify(r.commands));
    assert.match(read(r.commands[0].log), /Finished|Checking/, 'cargo ran');
    assert.equal(read(s.root, 'Cargo.lock'), before);
    assert.equal(read(s.root, 'Cargo.toml'), manifest('0.1.0'));
  } finally { s.done(); }
});

// A superproject whose rapid-game submodule tracks rust/Cargo.lock, recorded in the superproject.
function withSubmoduleLock() {
  const t = setup();
  mkdirSync(join(t.sub, 'rust'), { recursive: true });
  commitOnMain(t.sub, 'rust/Cargo.lock', LOCK, 'sub lock');
  g(['push', 'origin', 'main'], t.sub);
  g(['add', 'rapid-game'], t.root);
  g(['commit', '-m', 'pin sub lock'], t.root);
  g(['push', 'origin', 'main'], t.root);
  return t;
}

test('a lock inside a submodule that a superproject job rewrites is restored byte for byte', () => {
  const t = withSubmoduleLock();
  try {
    const { r } = t.run({}, '*** write game.txt\ng\n', [rewrite('rapid-game/rust/Cargo.lock')]);
    assert.equal(r.status, 'passed', JSON.stringify(r.commands));
    assert.equal(read(t.sub, 'rust', 'Cargo.lock'), LOCK);
    assert.equal(g(['status', '--porcelain'], t.sub), '');
  } finally { t.done(); }
});

// A daemon runs `cmd`, which rewrites `rel` then hangs on its first run; the test kills the
// daemon and the command.
async function killMidRun(root, cfg, jobId, hangFile) {
  const daemon = spawn(process.execPath, [BROKER, '--root', root, '--once'], { stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 600 && !existsSync(hangFile); i++) await sleep(100);
  assert.ok(existsSync(hangFile), 'the command rewrote the lock and is hanging');
  daemon.kill('SIGKILL');
  await new Promise((r) => (daemon.exitCode !== null ? r() : daemon.on('exit', r)));
  process.kill(Number(read(hangFile)));
  const marker = `${join(brokerPaths(cfg).logs, `${jobId}-0.log`)}.exit`;
  for (let i = 0; i < 100 && !existsSync(marker); i++) await sleep(100);
}

function hangingRewrite(dir, rel) {
  const file = join(dir, 'hang.cjs').replace(/\\/g, '/');
  const flag = join(dir, 'reached').replace(/\\/g, '/');
  writeFileSync(file, `const fs = require('fs');\nfs.appendFileSync(${JSON.stringify(rel)}, '# cargo rewrote this\\n');\nif (fs.existsSync(${JSON.stringify(flag)})) process.exit(0);\nfs.writeFileSync(${JSON.stringify(flag)}, String(process.pid));\nsetInterval(() => {}, 1 << 30);\n`);
  return { command: `node "${file}"`, flag };
}

test('a daemon killed after cargo rewrote Cargo.lock restores it at the next start, and the rerun leaves it identical', async () => {
  const s = withLock('Cargo.lock');
  try {
    writeFileSync(join(s.root, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: app, path: ., main: main, remote: origin }\n');
    const hang = hangingRewrite(tempDir('lock-hang-'), 'Cargo.lock');
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-1' }, envelope(['beta', 'BETA']));
    writeJob(s.cfg, { ...job, commands: [hang.command] });
    await killMidRun(s.root, s.cfg, job.id, hang.flag);
    assert.notEqual(read(s.root, 'Cargo.lock'), LOCK, 'the kill left the rewritten lock in the tree');
    assert.equal(recoverInflight(s.cfg).resume, null);
    assert.equal(read(s.root, 'Cargo.lock'), LOCK, 'the recovery restored it');
    assert.equal(g(['status', '--porcelain', '--untracked-files=no'], s.root), '');
    const second = spawn(process.execPath, [BROKER, '--root', s.root, '--once'], { stdio: 'ignore', windowsHide: true });
    await new Promise((r) => second.on('exit', r));
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
    assert.equal(read(s.root, 'Cargo.lock'), LOCK);
  } finally { s.done(); }
}, { timeout: 900_000 });

test('a daemon killed after a submodule Cargo.lock was rewritten restores it too', async () => {
  const t = withSubmoduleLock();
  try {
    mkdirSync(join(t.root, '.ai'), { recursive: true });
    writeFileSync(join(t.root, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: super, path: ., main: main, remote: origin }\n    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }\n');
    const hang = hangingRewrite(tempDir('lock-hang-'), 'rapid-game/rust/Cargo.lock');
    const { job } = buildPatchJob(t.cfg, { ticket: 'T-1' }, '*** write game.txt\ng\n');
    writeJob(t.cfg, { ...job, commands: [hang.command] });
    await killMidRun(t.root, t.cfg, job.id, hang.flag);
    assert.notEqual(read(t.sub, 'rust', 'Cargo.lock'), LOCK, 'the kill left the rewritten lock in the submodule');
    assert.equal(recoverInflight(t.cfg).resume, null);
    assert.equal(read(t.sub, 'rust', 'Cargo.lock'), LOCK);
    assert.equal(g(['status', '--porcelain'], t.sub), '');
  } finally { t.done(); }
}, { timeout: 900_000 });

test('a lock a superproject job creates inside a submodule is removed afterwards', () => {
  const t = withSubmoduleLock();
  try {
    const { r } = t.run({}, '*** write game.txt\ng\n', [`node -e "require('fs').mkdirSync('rapid-game/new');require('fs').writeFileSync('rapid-game/new/Cargo.lock','x')"`]);
    assert.equal(r.status, 'passed', JSON.stringify(r.commands));
    assert.equal(existsSync(join(t.sub, 'new', 'Cargo.lock')), false);
    assert.equal(g(['status', '--porcelain'], t.sub), '');
  } finally { t.done(); }
});
