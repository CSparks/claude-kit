// test-record.test.mjs — an interrupted nextest run resumes with only the tests not yet passed
// (KIT-T518). A real daemon runs a fake `cargo nextest` of six tests and is killed after three;
// the restart runs the other three. Any change to the job's inputs runs everything.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { brokerPaths, normalizeBroker } from './config.mjs';
import { excluding, isNextestRun } from './test-record.mjs';
import { recoverInflight } from './preimage.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, envelope, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const ALL = ['t1', 't2', 't3', 't4', 't5', 't6'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (binary, ...names) => names.map((test) => ({ binary, test }));

test('excluding: passes group by binary into one "not" filterset, ANDed with the command\'s own', () => {
  const out = excluding('cargo nextest run --no-fail-fast -p app', [...pass('app', 'a', 'b'), ...pass('app::it', 'c')]);
  assert.equal(out.skipped, 3);
  assert.equal(out.cmd, 'cargo nextest run --no-fail-fast -p app --no-tests=pass -E "not ((binary_id(=app) and (test(=a) or test(=b))) or (binary_id(=app::it) and (test(=c))))"');
  const own = excluding('cargo nextest run -p app -E "binary(it)" -- --nocapture', pass('app::it', 'c'));
  assert.equal(own.cmd, 'cargo nextest run -p app --no-tests=pass -E "(binary(it)) and not ((binary_id(=app::it) and (test(=c))))" -- --nocapture');
});

test('excluding: negative controls leave the command alone', () => {
  const cmd = 'cargo nextest run -p app';
  assert.deepEqual(excluding(cmd, []), { cmd, skipped: 0 });
  assert.deepEqual(excluding(cmd, pass(null, 'libtest_only')), { cmd, skipped: 0 });
  assert.deepEqual(excluding(cmd, pass('app', 'name with space', 'a(b)')), { cmd, skipped: 0 });
  const two = 'cargo nextest run -E "a" -E "b"';
  assert.deepEqual(excluding(two, pass('app', 'x')), { cmd: two, skipped: 0 });
});

test('excluding: a long pass list stays inside the shell command limit and drops the excess', () => {
  const many = Array.from({ length: 2000 }, (_, i) => ({ binary: 'app', test: `module::long_test_name_${i}` }));
  const out = excluding('cargo nextest run -p app', many);
  assert.ok(out.cmd.length < 7500, String(out.cmd.length));
  assert.ok(out.skipped > 100 && out.skipped < 2000, String(out.skipped));
});

test('isNextestRun: nextest, an alias expanding to it; not cargo test', () => {
  const s = fixture();
  try {
    assert.equal(isNextestRun('cargo nextest run -p a', s.root), true);
    assert.equal(isNextestRun('cargo nextest list', s.root), false);
    assert.equal(isNextestRun('cargo test -p a', s.root), false);
    assert.equal(isNextestRun('npm test', s.root), false);
    mkdirSync(join(s.root, '.cargo'));
    writeFileSync(join(s.root, '.cargo', 'config.toml'), '[alias]\nt = "nextest run --workspace"\nc = "check"\n');
    assert.equal(isNextestRun('cargo t -p a', s.root), true);
    assert.equal(isNextestRun('cargo c -p a', s.root), false);
  } finally { s.done(); }
});

// A fake `cargo nextest run` of ALL: it prints one PASS line per test it runs and honours the -E
// "not (…test(=x)…)" exclusions. With a `hang-after` file it stops after that many tests, writes
// `reached` with its pid and waits to be killed (consuming the file, so a rerun completes).
function fakeNextest() {
  const dir = tempDir('fake-nextest-');
  const script = [
    "const fs = require('fs'); const path = require('path');",
    `const dir = ${JSON.stringify(dir)}; const args = process.argv.slice(2);`,
    "fs.appendFileSync(path.join(dir, 'calls.log'), args.join(' ') + '\\n');",
    "const e = args.indexOf('-E');",
    "const skip = e < 0 ? [] : [...args[e + 1].matchAll(/test\\(=([^)]+)\\)/g)].map((m) => m[1]);",
    "const hang = path.join(dir, 'hang-after'); const limit = fs.existsSync(hang) ? Number(fs.readFileSync(hang, 'utf8')) : Infinity;",
    `let ran = 0; for (const t of ${JSON.stringify(ALL)}) {`,
    "  if (skip.includes(t)) continue;",
    "  console.log('        PASS [   0.010s] app ' + t); fs.appendFileSync(path.join(dir, 'ran.log'), t + '\\n'); ran++;",
    "  if (ran === limit) { fs.rmSync(hang); fs.writeFileSync(path.join(dir, 'reached'), String(process.pid)); setInterval(() => {}, 1 << 30); break; }",
    "}",
    "if (ran !== limit) console.log('     Summary [   0.1s] ' + ran + ' tests run: ' + ran + ' passed');",
  ].join('\n');
  writeFileSync(join(dir, 'fake.cjs'), script);
  const cmdline = `node "${join(dir, 'fake.cjs').replace(/\\/g, '/')}"`;
  if (process.platform === 'win32') writeFileSync(join(dir, 'cargo.cmd'), `@${cmdline} %*\r\n`);
  else writeFileSync(join(dir, 'cargo'), `#!/bin/sh\n${cmdline} "$@"\n`, { mode: 0o755 });
  const lines = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').trim().split('\n') : []);
  return { dir, hangAfter: (n) => writeFileSync(join(dir, 'hang-after'), String(n)), calls: () => lines('calls.log'), ran: () => lines('ran.log'), done: () => cleanup(dir) };
}

// A fixture whose daemon config runs nextest; returns the job id of a queued check-only patch.
function interrupted() {
  const s = fixture();
  const cargo = fakeNextest();
  const path = process.env.PATH;
  process.env.PATH = `${cargo.dir}${delimiter}${path}`;
  writeFileSync(join(s.root, '.ai', 'config.yml'), 'broker:\n  runner: nextest\n  repos:\n    - { name: app, path: ., main: main, remote: origin }\n');
  const cfg = normalizeBroker(s.root, { runner: 'nextest', repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }] });
  const { job } = buildPatchJob(cfg, { ticket: 'T-1' }, envelope(['beta', 'BETA']));
  writeJob(cfg, { ...job, commands: ['cargo t -p app --lib', 'cargo t -p app --test a'] });
  return { ...s, cfg, cargo, job, done: () => { process.env.PATH = path; cargo.done(); s.done(); } };
}

async function killMidRun(s) {
  s.cargo.hangAfter(3);
  const first = spawn(process.execPath, [BROKER, '--root', s.root, '--once'], { stdio: 'ignore', windowsHide: true });
  const reached = join(s.cargo.dir, 'reached');
  for (let i = 0; i < 600 && !existsSync(reached); i++) await sleep(100);
  assert.ok(existsSync(reached), 'the fake run reached three tests');
  first.kill('SIGKILL');
  await new Promise((r) => (first.exitCode !== null ? r() : first.on('exit', r)));
  process.kill(Number(readFileSync(reached, 'utf8')));
  const exitMarker = `${join(brokerPaths(s.cfg).logs, `${s.job.id}-0.log`)}.exit`;
  for (let i = 0; i < 100 && !existsSync(exitMarker); i++) await sleep(100);
  writeFileSync(brokerPaths(s.cfg).lock, '');
}

const restart = async (s) => {
  const second = spawn(process.execPath, [BROKER, '--root', s.root, '--once'], { stdio: 'ignore', windowsHide: true });
  await new Promise((r) => (second.exitCode !== null ? r() : second.on('exit', r)));
  return readResult(s.cfg, s.job.id);
};

test('a run killed after 3 of 6 tests restarts and runs only the other 3', async () => {
  const s = interrupted();
  try {
    await killMidRun(s);
    assert.deepEqual(s.cargo.ran(), ['t1', 't2', 't3']);
    const r = await restart(s);
    assert.equal(r.status, 'passed', JSON.stringify(r.commands));
    assert.deepEqual(s.cargo.ran(), ALL, 'each test ran once across both attempts');
    assert.equal(s.cargo.calls().length, 2);
    assert.match(s.cargo.calls()[1], /-E not \(\(binary_id\(=app\) and \(test\(=t1\) or test\(=t2\) or test\(=t3\)\)\)\)/);
    assert.equal(r.commands[0].resumedSkipped, 3);
    assert.equal(r.commands[0].cmd, 'cargo nextest run --no-fail-fast -p app --lib --test a');
    assert.equal(existsSync(join(brokerPaths(s.cfg).home, 'testrun', `${s.job.id}.json`)), false, 'the record goes with the result');
  } finally { s.done(); }
}, { timeout: 120_000 });

test('negative control: a changed command or a moved HEAD discards the record and runs all 6', async () => {
  for (const change of ['commands', 'head']) {
    const s = interrupted();
    try {
      await killMidRun(s);
      if (change === 'commands') writeJob(s.cfg, { ...JSON.parse(readFileSync(join(brokerPaths(s.cfg).queue, `${s.job.id}.json`), 'utf8')), commands: ['cargo t -p app --lib', 'cargo t -p app --test b'] });
      else {
        recoverInflight(s.cfg);
        commitOnMain(s.root, 'other.txt', 'moved\n', 'move HEAD');
      }
      const r = await restart(s);
      assert.equal(r.status, 'passed', `${change}: ${JSON.stringify(r.commands)}`);
      assert.deepEqual(s.cargo.ran().slice(3), ALL, `${change}: the restart ran everything`);
      assert.doesNotMatch(s.cargo.calls()[1], /-E/, change);
      assert.equal(r.commands[0].resumedSkipped, undefined, change);
    } finally { s.done(); }
  }
}, { timeout: 180_000 });
