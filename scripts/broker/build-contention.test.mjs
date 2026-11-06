// build-contention.test.mjs — a broker build yields to foreign cargo builds (KIT-T873, KIT-T874).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { foreignBuilds, governedPids, summarize, waitForQuiet } from './build-contention.mjs';

const OWN = 100;
const POLL = 5;
const proc = (pid, ppid, name, cmd = name) => ({ pid, ppid, name, cmd });

const MACHINE = [
  proc(OWN, 1, 'node.exe', 'node broker.mjs'),
  proc(101, OWN, 'cargo.exe', 'cargo test -p game'),
  proc(102, 101, 'rustc.exe', 'rustc --crate-name game'),
  proc(200, 1, 'node.exe', 'node pre-push.mjs'),
  proc(201, 200, 'cargo.exe', 'cargo  test --doc --workspace -j 3'),
  proc(202, 201, 'cargo.exe', '"C:\\Users\\x\\.rustup\\toolchains\\1.95\\bin\\cargo.exe" test --doc --workspace -j 3'),
  proc(203, 202, 'rustc.exe', 'rustc --crate-name rg_engine'),
  proc(300, 1, 'rust-analyzer.exe', 'rust-analyzer'),
  proc(301, 300, 'cargo.exe', 'cargo check --workspace --all-targets'),
  proc(400, 1, 'cargo.exe', 'cargo fmt --check'),
  proc(500, 1, 'rustc.exe', 'rustc -vV'),
  proc(501, 1, 'rustc.exe', 'rustc --crate-name tool src/main.rs'),
];

test('foreignBuilds names each foreign build root once and skips the broker\'s own tree', () => {
  const found = foreignBuilds(MACHINE, [OWN]);
  assert.deepEqual(found.map((b) => b.pid), [201, 301, 501]);
  assert.equal(found[0].cmd, 'cargo  test --doc --workspace -j 3');
});

test('foreignBuilds ignores cargo subcommands that do not compile', () => {
  assert.deepEqual(foreignBuilds([proc(400, 1, 'cargo.exe', 'cargo fmt --check')], [OWN]), []);
});

test('foreignBuilds strips a quoted toolchain path from the command it reports', () => {
  const [b] = foreignBuilds([proc(1, 1000, 'cargo.exe', '"C:\\a b\\cargo.exe" check -p x')], [OWN]);
  assert.equal(b.cmd, 'cargo check -p x');
});

test('governedPids holds this process and every slot holder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'contention-'));
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'slot-0'), JSON.stringify({ pid: 4242 }));
    writeFileSync(join(dir, 'slot-1'), 'not json');
    assert.deepEqual(governedPids(dir), [process.pid, 4242]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('waitForQuiet returns at once on a quiet machine', () => {
  const r = waitForQuiet({ ownPids: [OWN], list: () => [proc(OWN, 1, 'node.exe')], pollMs: POLL, maxWaitMs: 1000 });
  assert.deepEqual([r.quiet, r.contendedBy], [true, []]);
});

test('waitForQuiet waits for the foreign build to end and names it', () => {
  let polls = 0;
  const list = () => (polls++ < 3 ? [proc(300, 1, 'cargo.exe', 'cargo check --workspace')] : []);
  const r = waitForQuiet({ ownPids: [OWN], list, pollMs: POLL, maxWaitMs: 5000 });
  assert.equal(r.quiet, true);
  assert.deepEqual(r.contendedBy, ['pid 300 cargo check --workspace']);
  assert.ok(r.waitedMs >= 3 * POLL - 1);
});

test('waitForQuiet gives up at its bound and reports the builds still running', () => {
  const list = () => [proc(300, 1, 'cargo.exe', 'cargo check --workspace')];
  const r = waitForQuiet({ ownPids: [OWN], list, pollMs: POLL, maxWaitMs: 30 });
  assert.equal(r.quiet, false);
  assert.ok(r.waitedMs >= 30);
  assert.equal(r.contendedBy.length, 1);
});

test('waitForQuiet stops when cancelled', () => {
  const list = () => [proc(300, 1, 'cargo.exe', 'cargo check')];
  const r = waitForQuiet({ ownPids: [OWN], list, pollMs: POLL, maxWaitMs: 60000, shouldCancel: () => true });
  assert.equal(r.quiet, false);
});

test('by default one sample names the foreign build and nothing waits (KIT-D105)', () => {
  let polls = 0;
  const list = () => { polls++; return [proc(300, 1, 'cargo.exe', 'cargo check --workspace')]; };
  const r = waitForQuiet({ ownPids: [OWN], list });
  assert.deepEqual([polls, r.waitedMs < 100, r.quiet], [1, true, false]);
  assert.deepEqual(r.contendedBy, ['pid 300 cargo check --workspace']);
});

test('CLAUDE_KIT_CONTENTION_WAIT_MS opts in to the bounded wait', () => {
  process.env.CLAUDE_KIT_CONTENTION_WAIT_MS = '40';
  try {
    const list = () => [proc(300, 1, 'cargo.exe', 'cargo check')];
    const r = waitForQuiet({ ownPids: [OWN], list, pollMs: POLL });
    assert.ok(r.waitedMs >= 40);
  } finally { delete process.env.CLAUDE_KIT_CONTENTION_WAIT_MS; }
});

test('summarize names four builds and counts the rest', () => {
  const builds = [1, 2, 3, 4, 5, 6].map((pid) => ({ pid, cmd: `cargo check -p c${pid}` }));
  const out = summarize(builds);
  assert.equal(out.length, 5);
  assert.equal(out[4], 'and 2 more');
});
