// prebuild.test.mjs — a landing's check also builds what the repo's pre-push gate will run
// (KIT-T561): the `gate_prebuild` command runs once after the job's tests when the landing reaches a
// crate, in a train once for all members. Controls: a docs-only landing, a repo without pre_push, and
// a check-only job add nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { prebuildCommand, withPrebuild } from './prebuild.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const PASS = 'node -e "0"';

function crateFixture({ prePush = true, prebuild = true } = {}) {
  const s = fixture();
  for (const name of ['a', 'b']) {
    mkdirSync(join(s.root, 'crates', name, 'src'), { recursive: true });
    writeFileSync(join(s.root, 'crates', name, 'Cargo.toml'), `[package]\nname = "${name}"\nversion = "0.0.0"\n`);
    writeFileSync(join(s.root, 'crates', name, 'src', 'lib.rs'), `pub fn ${name}() {}\n`);
  }
  writeFileSync(join(s.root, 'README.md'), 'docs\n');
  g(['add', '-A'], s.root);
  g(['commit', '-m', 'crates'], s.root);
  g(['push', 'origin', 'main'], s.root);
  const dir = tempDir('prebuild-');
  const log = join(dir, 'prebuild.log');
  const script = join(dir, 'mark.mjs');
  writeFileSync(script, ["import { appendFileSync } from 'node:fs';", "appendFileSync(process.argv[2], 'built' + String.fromCharCode(10));", ''].join('\n'));
  const command = `node "${script}" "${log}"`;
  s.repo = { name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: prePush, ...(prebuild ? { gate_prebuild: command } : {}) };
  s.cfg = normalizeBroker(s.root, { repos: [s.repo], verify_default: [PASS] });
  s.runs = () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0);
  s.command = command;
  return { ...s, done: () => { s.done(); cleanup(dir); } };
}

const libEdit = (name) => `*** edit crates/${name}/src/lib.rs\n<<<<<<< SEARCH\npub fn ${name}() {}\n=======\npub fn ${name}() { let _ = 1; }\n>>>>>>> REPLACE\n`;
const docEdit = '*** edit README.md\n<<<<<<< SEARCH\ndocs\n=======\nmore docs\n>>>>>>> REPLACE\n';

function submit(s, envelope, flags = { land: true }) {
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'change', ...flags }, envelope);
  writeJob(s.cfg, { ...job, commands: [PASS] });
  return job;
}

test('a landing that reaches a crate runs the gate_prebuild command once, after the job\'s own tests', () => {
  const s = crateFixture();
  try {
    const job = submit(s, libEdit('a'));
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(r.commands.map((c) => c.cmd), [PASS, s.command]);
    assert.equal(s.runs(), 1);
  } finally { s.done(); }
});

test('a train of landings builds the gate\'s binaries once for all members', () => {
  const s = crateFixture();
  try {
    const jobs = [submit(s, libEdit('a')), submit(s, libEdit('b'))];
    processOnce(s.cfg);
    assert.deepEqual(jobs.map((j) => readResult(s.cfg, j.id).status), ['landed', 'landed']);
    assert.equal(s.runs(), 1);
  } finally { s.done(); }
});

test('controls: docs-only, check-only, no pre_push and no gate_prebuild add nothing', () => {
  const docs = crateFixture();
  try {
    const job = submit(docs, docEdit);
    processOnce(docs.cfg);
    assert.equal(readResult(docs.cfg, job.id).status, 'landed');
    assert.equal(docs.runs(), 0, 'docs-only');
    const check = submit(docs, libEdit('a'), {});
    processOnce(docs.cfg);
    assert.equal(readResult(docs.cfg, check.id).status, 'passed');
    assert.equal(docs.runs(), 0, 'check-only');
  } finally { docs.done(); }
  for (const opts of [{ prePush: false }, { prebuild: false }]) {
    const s = crateFixture(opts);
    try {
      const job = submit(s, libEdit('a'));
      processOnce(s.cfg);
      assert.equal(readResult(s.cfg, job.id).status, 'landed');
      assert.equal(s.runs(), 0, JSON.stringify(opts));
    } finally { s.done(); }
  }
});

test('prebuildCommand: a path no crate owns (the gate\'s full lane) and withPrebuild dedupe', () => {
  const s = crateFixture();
  try {
    const stray = new Map([['stray.rs', { text: 'fn x() {}\n' }]]);
    assert.equal(prebuildCommand(s.cfg.repos[0], s.root, stray), null);
    assert.deepEqual(withPrebuild(['a'], 'b'), ['a', 'b']);
    assert.deepEqual(withPrebuild(['a', 'b'], 'b'), ['a', 'b']);
    assert.deepEqual(withPrebuild(['a'], null), ['a']);
  } finally { s.done(); }
});
