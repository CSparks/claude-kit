// testkit-leak.test.mjs — a test that forgets to clean its fixture, or dies before it can, still
// leaves no temp dir and no daemon behind (KIT-T502), and a test process never auto-starts a daemon.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const KIT = pathToFileURL(join(import.meta.dirname, 'testkit.mjs')).href;

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// Runs a child that leaks a fixture with a live fake daemon; `crash` makes it throw instead of exit.
function leakyChild(crash) {
  const code = `
    import { tempDir } from ${JSON.stringify(KIT)};
    import { spawn } from 'node:child_process';
    import { mkdirSync, writeFileSync } from 'node:fs';
    import { hostname } from 'node:os';
    import { join } from 'node:path';
    const dir = tempDir('patch-leak-');
    const d = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore', detached: true });
    d.unref();
    mkdirSync(join(dir, 'target', 'broker'), { recursive: true });
    writeFileSync(join(dir, 'target', 'broker', 'broker.lock'), JSON.stringify({ pid: d.pid, host: hostname() }));
    console.log(JSON.stringify({ dir, pid: d.pid, autostart: process.env.BROKER_NO_AUTOSTART }));
    ${crash ? "throw new Error('boom');" : ''}
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'BROKER_NO_AUTOSTART')) });
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

for (const crash of [false, true]) {
  test(`an uncleaned fixture and its daemon are gone after the process ${crash ? 'crashes' : 'exits'}`, () => {
    const { dir, pid, autostart } = leakyChild(crash);
    assert.equal(autostart, '1', 'autostart is off under the testkit');
    assert.ok(!existsSync(dir), 'temp dir removed');
    const end = Date.now() + 3000;
    while (alive(pid) && Date.now() < end) { /* wait for the kill to land */ }
    assert.ok(!alive(pid), 'daemon stopped');
  });
}
