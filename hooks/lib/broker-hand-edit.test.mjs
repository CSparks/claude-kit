// broker-hand-edit.test.mjs — a hand edit to a build input of a lane whose daemon is live gets one
// warning per session and lane (KIT-T568); docs, a dead lock, a repo that is not brokered, and a
// repeat edit stay silent. The pre-write hook carries it to the editor's stderr without blocking.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handEditWarning } from './broker-hand-edit.mjs';

const PRE_WRITE = fileURLToPath(new URL('../pre-write.mjs', import.meta.url));
const DEAD_PID = 2147483646;
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'bhe-turn-'));

function repo({ lock = 'live', brokered = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bhe-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, '.ai'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  if (brokered) writeFileSync(join(dir, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: app, path: . }\n');
  writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\nmembers = []\n');
  writeFileSync(join(dir, 'src', 'lib.rs'), 'fn a() {}\n');
  writeFileSync(join(dir, 'README.md'), 'doc\n');
  execFileSync('git', ['add', 'Cargo.toml', 'src/lib.rs'], { cwd: dir });
  if (lock) {
    mkdirSync(join(dir, 'target', 'broker'), { recursive: true });
    writeFileSync(join(dir, 'target', 'broker', 'broker.lock'), JSON.stringify({ pid: lock === 'live' ? process.pid : DEAD_PID, host: hostname() }));
  }
  return dir;
}

test('a build-input edit under a live daemon warns once per session, naming the daemon, the queue and the pause command', () => {
  const dir = repo();
  const w = handEditWarning(join(dir, 'src', 'lib.rs'), 'sess-1');
  assert.match(w, new RegExp(`pid ${process.pid}, root lane`));
  assert.match(w, /pauses its queue/);
  assert.match(w, /0 job\(s\) wait/);
  assert.match(w, /broker\.mjs pause --root/);
  assert.equal(handEditWarning(join(dir, 'src', 'lib.rs'), 'sess-1'), null, 'the same session hears it once');
  assert.ok(handEditWarning(join(dir, 'src', 'lib.rs'), 'sess-2'), 'another session hears it too');
});

test('controls: a doc, a dead lock and a repo that is not brokered stay silent', () => {
  const live = repo();
  assert.equal(handEditWarning(join(live, 'README.md'), 'sess-3'), null, 'a doc is no build input');
  assert.equal(handEditWarning(join(repo({ lock: 'dead' }), 'src', 'lib.rs'), 'sess-3'), null);
  assert.equal(handEditWarning(join(repo({ brokered: false }), 'src', 'lib.rs'), 'sess-3'), null);
});

test('the pre-write hook prints the warning and still allows the write', () => {
  const dir = repo();
  const r = spawnSync(process.execPath, [PRE_WRITE], {
    cwd: dir, encoding: 'utf8', env: { ...process.env },
    input: JSON.stringify({ session_id: 'sess-4', tool_input: { file_path: join(dir, 'src', 'lib.rs'), content: 'fn a() {}\n' } }),
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /broker daemon .* is live, and this edit to a build input pauses its queue/);
});
