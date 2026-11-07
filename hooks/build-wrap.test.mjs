// build-wrap.test.mjs — every shell command that runs a Rust build tool gets the build-budget shims ahead on PATH (KIT-D135).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { shimmedCommand } from './lib/build-wrap.mjs';

const HOOK = new URL('./build-wrap.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ROW_TAG = new URL('./row-tag.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SHIMS = 'build-shims';

const hook = (script, tool_name, tool_input) => {
  const r = spawnSync(process.execPath, [script], { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' });
  return { code: r.status, out: r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.updatedInput : null };
};

test('a command that runs cargo, nextest or ndk is led by the shim directory', () => {
  for (const cmd of ['cargo test -p x', 'cd rust && cargo t | tail -5', 'FOO=1 cargo-nextest run', 'cargo-ndk -t arm64-v8a build', 'bash -c "cargo build"']) {
    assert.ok(shimmedCommand(cmd, 'Bash')?.includes(SHIMS), cmd);
    assert.ok(shimmedCommand(cmd, 'Bash').endsWith(cmd), `${cmd} is kept whole`);
  }
});

test('PowerShell gets the same prefix in its own syntax', () => {
  assert.match(shimmedCommand('cargo build', 'PowerShell'), /^\$env:PATH = '.*build-shims;' \+ \$env:PATH; cargo build$/);
});

test('commands that build nothing, and broker calls that name cargo in a test, are left alone', () => {
  for (const cmd of ['ls -la', 'git status', 'q code "cargo test"', 'node scripts/broker/submit.mjs --test "cargo t -p x"', 'node scripts/broker/wait.mjs abc']) {
    assert.equal(shimmedCommand(cmd, 'Bash'), null, cmd);
  }
  assert.equal(shimmedCommand(shimmedCommand('cargo check', 'Bash'), 'Bash'), null, 'never wrapped twice');
});

test('the hook rewrites a foreground cargo command and keeps every other field', () => {
  const r = hook(HOOK, 'Bash', { command: 'cargo test', timeout: 5000, description: 'run tests' });
  assert.equal(r.code, 0);
  assert.ok(r.out.command.includes(SHIMS));
  assert.deepEqual([r.out.timeout, r.out.description], [5000, 'run tests']);
  assert.equal(hook(HOOK, 'Bash', { command: 'ls' }).out, null);
});

test('a background cargo command is wrapped by row-tag in the same input as its description, never by the hook alone', () => {
  assert.equal(hook(HOOK, 'Bash', { command: 'cargo build', run_in_background: true }).out, null);
  const r = hook(ROW_TAG, 'Bash', { command: 'cargo build', description: 'Build', run_in_background: true });
  assert.ok(r.out.command.includes(SHIMS));
  assert.match(r.out.description, /Build/);
});
