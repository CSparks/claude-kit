// git-bash.mjs — `builds --run` resolves Git for Windows' bash and never a WSL bash earlier on PATH (KIT-T1438).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { GIT_BASH_MISSING, resolveGitBash } from './git-bash.mjs';
import { readRun, startRun, waitRun } from './detached-run.mjs';

const WIN = { platform: 'win32' };
const filesystem = (...present) => (path) => present.includes(path);
const GIT = join('C:', 'Program Files', 'Git');
const WSL_DIR = join('C:', 'WINDOWS', 'system32');
const GIT_BASH = join(GIT, 'usr', 'bin', 'bash.exe');

test('the bash of the Git install holding the git on PATH is chosen over a WSL bash listed first', () => {
  const pathEnv = [WSL_DIR, join(GIT, 'mingw64', 'bin')].join(delimiter);
  const exists = filesystem(join(WSL_DIR, 'bash.exe'), join(GIT, 'mingw64', 'bin', 'git.exe'), GIT_BASH);
  assert.equal(resolveGitBash({ ...WIN, pathEnv, env: {}, exists }), GIT_BASH);
});

test('a git on PATH under cmd resolves the same install', () => {
  const pathEnv = join(GIT, 'cmd');
  const exists = filesystem(join(GIT, 'cmd', 'git.exe'), GIT_BASH);
  assert.equal(resolveGitBash({ ...WIN, pathEnv, env: {}, exists }), GIT_BASH);
});

test('with no git on PATH the Program Files install is used', () => {
  const exists = filesystem(GIT_BASH);
  assert.equal(resolveGitBash({ ...WIN, pathEnv: WSL_DIR, env: { ProgramFiles: join('C:', 'Program Files') }, exists }), GIT_BASH);
});

test('GIT_INSTALL_ROOT wins over a git found later', () => {
  const custom = join('D:', 'tools', 'Git');
  const customBash = join(custom, 'usr', 'bin', 'bash.exe');
  const exists = filesystem(customBash, GIT_BASH, join(GIT, 'cmd', 'git.exe'));
  assert.equal(resolveGitBash({ ...WIN, pathEnv: join(GIT, 'cmd'), env: { GIT_INSTALL_ROOT: custom }, exists }), customBash);
});

test('a WSL bash alone is never returned: no Git install means null', () => {
  const exists = filesystem(join(WSL_DIR, 'bash.exe'));
  assert.equal(resolveGitBash({ ...WIN, pathEnv: WSL_DIR, env: {}, exists }), null);
  assert.match(GIT_BASH_MISSING, /Bash tool/);
});

test('off Windows nothing is resolved', () => {
  assert.equal(resolveGitBash({ platform: 'linux', pathEnv: '/usr/bin', env: {}, exists: () => true }), null);
});

test('a run launched with a WSL-style bash first on PATH still runs under Git bash', { skip: process.platform !== 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'gb-'));
  mkdirSync(join(root, '.ai'));
  const saved = process.env.PATH;
  process.env.PATH = [join(process.env.SystemRoot || 'C:\\WINDOWS', 'System32'), saved].join(delimiter);
  try {
    const record = startRun({ command: 'echo "kernel=$(uname -s)"; node -e "console.log(\'node-ok\')"', cwd: root, root });
    const ended = waitRun(root, record.id, { capS: 30 });
    const output = readFileSync(readRun(root, record.id).out, 'utf8');
    assert.equal(ended.exit, 0, output);
    assert.match(output, /kernel=(MINGW|MSYS)/);
    assert.match(output, /node-ok/);
  } finally { process.env.PATH = saved; }
});
