// submit-usage.test.mjs — submit.mjs never waits on stdin for help or a terminal (KIT-T550):
// --help and -h print usage and exit 0 while stdin stays open, a terminal stdin with no envelope
// prints usage and exits 2. Controls: a piped envelope still submits, and --no-patch needs none.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { SUBMIT_USAGE, submitUsageProblem } from './submit-usage.mjs';
import { listQueue } from './result.mjs';
import { envelope, fixture } from './patchkit.mjs';

const SUBMIT = join(import.meta.dirname, 'submit.mjs');
const HANG_MS = 20_000;

// Run submit.mjs with stdin left OPEN (a hang shows as a timeout, not an EOF); `input` is written without closing it.
function runSubmit(args, input = null) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [SUBMIT, ...args], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    let out = '';
    let err = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    if (input != null) { c.stdin.write(input); c.stdin.end(); }
    const timer = setTimeout(() => { c.kill(); resolve({ hung: true, code: null, out, err }); }, HANG_MS);
    c.on('exit', (code) => { clearTimeout(timer); resolve({ hung: false, code, out, err }); });
  });
}

test('--help and -h print the usage and exit 0 without reading stdin', async () => {
  const s = fixture();
  try {
    for (const flag of ['--help', '-h']) {
      const r = await runSubmit(['--root', s.root, flag]);
      assert.equal(r.hung, false, `${flag} must not wait on stdin`);
      assert.equal(r.code, 0);
      assert.match(r.out + r.err, /usage: submit\.mjs/);
    }
    assert.equal(listQueue(s.cfg).length, 0, 'help queues nothing');
  } finally { s.done(); }
});

test('a terminal stdin with no envelope is a usage error, a pipe or --no-patch is not', () => {
  const flags = {};
  assert.equal(submitUsageProblem([], flags, { isTTY: true }).code, 2);
  assert.match(submitUsageProblem([], flags, { isTTY: true }).text, /terminal/);
  assert.equal(submitUsageProblem([], flags, { isTTY: false }), null, 'control: a piped stdin is read');
  assert.equal(submitUsageProblem([], { 'no-patch': true }, { isTTY: true }), null, 'control: --no-patch needs no envelope');
  assert.equal(submitUsageProblem(['-h'], flags, { isTTY: true }).code, 0);
  assert.equal(submitUsageProblem([], { help: true }, { isTTY: false }).text, SUBMIT_USAGE);
});

test('control: a piped envelope still queues the job', async () => {
  const s = fixture();
  try {
    const r = await runSubmit(['--root', s.root, '--ticket', 'T-1', '--title', 'beta', '--test', 'node -e "0"'], envelope(['beta', 'BETA']));
    assert.equal(r.code, 0, r.err);
    assert.equal(listQueue(s.cfg).length, 1);
  } finally { s.done(); }
});
