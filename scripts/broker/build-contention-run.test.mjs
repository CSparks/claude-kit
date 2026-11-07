// build-contention-run.test.mjs — runCancellable holds a cargo build until a foreign cargo build ends and reports
// the wait as slotWaitMs and the foreign build as contendedBy (KIT-T873, KIT-T874).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { foreignBuilds, governedPids, listProcesses } from './build-contention.mjs';
import { runCancellable } from './run-cancellable.mjs';

const FOREIGN_MS = 6000;
const SEEN_MS = 20000;
const WAIT_MS = 8000;
const WINDOWS = process.platform === 'win32';
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// A node binary named `cargo` running a script named `check`: its command line reads `cargo check`. A launcher that exits
// starts it, so it is not a child of this process (a child would be governed, not foreign): { pid, kill() }.
function foreignCargo(dir) {
  const exe = join(dir, WINDOWS ? 'cargo.exe' : 'cargo');
  if (WINDOWS) copyFileSync(process.execPath, exe); else symlinkSync(process.execPath, exe);
  writeFileSync(join(dir, 'check'), `setTimeout(() => {}, ${FOREIGN_MS});`);
  const launcher = `const c = require('node:child_process').spawn(${JSON.stringify(exe)}, ['check'], { cwd: ${JSON.stringify(dir)}, stdio: 'ignore', windowsHide: true, detached: true }); console.log(c.pid); c.unref();`;
  const pid = Number(spawnSync(process.execPath, ['-e', launcher], { encoding: 'utf8', windowsHide: true }).stdout);
  return { pid, kill: () => { try { process.kill(pid); } catch { /* already finished */ } } };
}

test('a cargo command waits out a foreign cargo build and names it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'contention-run-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = join(dir, 'slots');
  process.env.CLAUDE_KIT_CONTENTION_WAIT_MS = String(WAIT_MS);
  const foreign = foreignCargo(dir);
  try {
    for (const end = Date.now() + SEEN_MS; !foreignBuilds(listProcesses(), governedPids()).some((b) => b.pid === foreign.pid) && Date.now() < end;) sleep(200);
    const r = runCancellable('cargo check --manifest-path nowhere/Cargo.toml', { cwd: dir, targetDir: join(dir, 'target'), logPath: join(dir, 'run.log'), jobs: 2 }, { shouldCancel: () => false, pollMs: 50 });
    assert.ok(r.slotWaitMs > 0, `waited ${r.slotWaitMs} ms for the foreign build`);
    assert.ok(r.contendedBy && r.contendedBy.length > 0, 'the foreign builds seen are reported');
  } finally {
    foreign.kill();
    delete process.env.CLAUDE_KIT_BUILD_SLOT_DIR;
    delete process.env.CLAUDE_KIT_CONTENTION_WAIT_MS;
    rmSync(dir, { recursive: true, force: true });
  }
});
