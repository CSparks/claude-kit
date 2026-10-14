#!/usr/bin/env node
// deck-deploy.test.mjs — an offline Deck is a maintainer action, never a wait (KIT-T480): the
// reachability check answers in seconds, a deploy or watch against an unreachable Deck exits 3
// before any build with the MAINTAINER ACTION line, and `watch` returns to its caller at once.
// The real Deck is never contacted: the target is a local port. Run: node scripts/deck-deploy.test.mjs

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reachable } from './deck-reach.mjs';

const SCRIPT = join(import.meta.dirname, 'deck-deploy.mjs');
const FAST_MS = 5000;
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };

const home = mkdtempSync(join(tmpdir(), 'kit-deck-'));
const server = createServer((s) => s.destroy());
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const openPort = server.address().port;
const closed = createServer();
await new Promise((r) => closed.listen(0, '127.0.0.1', r));
const closedPort = closed.address().port;
await new Promise((r) => closed.close(r));

const target = (port) => {
  const f = join(home, `deck-${port}.json`);
  writeFileSync(f, JSON.stringify({ host: '127.0.0.1', user: 'deck', key: '~/.ssh/none', port }));
  return f;
};

// Async so the local listener keeps accepting while the CLI runs.
function cli(port, args) {
  return new Promise((resolve) => {
    const started = Date.now();
    const env = { ...process.env, CLAUDE_KIT_STEAMDECK: target(port), CLAUDE_KIT_DECK_HOME: home };
    const p = spawn(process.execPath, [SCRIPT, ...args], { env, windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    const kill = setTimeout(() => p.kill(), 30000);
    p.on('close', (status) => { clearTimeout(kill); resolve({ status, out, err, ms: Date.now() - started }); });
  });
}

const alertFile = join(home, 'alert.txt');

try {
  const up = await reachable({ host: '127.0.0.1', port: openPort }, 1000);
  const refused = await reachable({ host: '127.0.0.1', port: closedPort }, 1000);
  const t0 = Date.now();
  const silent = await reachable({ host: '10.255.255.1', port: 22 }, 300);
  const silentMs = Date.now() - t0;
  ok('reachable: a listening port answers, a refused or silent one does not, and the silent one is bounded', () => {
    assert.equal(up, true);
    assert.equal(refused, false);
    assert.equal(silent, false);
    assert.ok(silentMs < 2000, `${silentMs} ms`);
  });

  const deploy = await cli(closedPort, ['some-game']);
  ok('deploy to an unreachable Deck exits 3 at once with the maintainer line and starts no build', () => {
    assert.equal(deploy.status, 3, deploy.err);
    assert.ok(deploy.ms < FAST_MS + 5000, `${deploy.ms} ms`);
    assert.match(deploy.err, /MAINTAINER ACTION: Deck unreachable .* wake it and connect Wi-Fi, then re-run: deck-deploy some-game/);
    assert.doesNotMatch(deploy.out, /build \+ push/);
    assert.match(readFileSync(alertFile, 'utf8'), /MAINTAINER ACTION/, 'orient sees the alert');
  });

  const watchDown = await cli(closedPort, ['watch', '--interval', '3600']);
  ok('watch against an unreachable Deck exits 3 and starts no background watcher', () => {
    assert.equal(watchDown.status, 3, watchDown.err);
    assert.equal(existsSync(join(home, 'watch.log')), false);
  });

  const check = await cli(openPort, ['check']);
  ok('negative control: check against a Deck that answers exits 0 and clears the alert', () => {
    assert.equal(check.status, 0, check.err);
    assert.equal(existsSync(alertFile), false);
  });

  const watchUp = await cli(openPort, ['watch', '--interval', '3600']);
  const pid = Number((watchUp.out.match(/pid (\d+)/) || [])[1]);
  try {
    ok('watch against a Deck that answers returns at once and leaves a detached watcher logging to a file', () => {
      assert.equal(watchUp.status, 0, watchUp.err);
      assert.ok(watchUp.ms < FAST_MS + 5000, `${watchUp.ms} ms: the caller was held`);
      assert.ok(pid > 0, watchUp.out);
      assert.match(watchUp.out, /watch\.log/);
    });
  } finally {
    try { process.kill(pid); } catch { /* already gone */ }
  }
} finally {
  server.close();
  try { rmSync(home, { recursive: true, force: true }); } catch { /* the killed watcher may still hold its log */ }
}
console.log(`deck-deploy: ${passed} passed, 0 failed`);
