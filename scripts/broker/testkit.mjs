// testkit.mjs — throwaway git fixtures for the broker tests. NOT a test: it builds real, tiny
// git repos in a temp dir whose "build" commands are plain shell (node -e / echo), so the suite
// runs in seconds and needs no cargo. Every fixture is a real repo so the git protocol (path
// commits, push, submodule pin) is exercised for real, never mocked.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function g(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Try a git command; return '' on failure (for probes like rev-parse on an empty ref).
export function gTry(args, cwd) {
  try {
    return g(args, cwd);
  } catch {
    return '';
  }
}

// A test never auto-starts a daemon (submit/wait honour this, and children inherit it).
process.env.BROKER_NO_AUTOSTART ??= '1';
process.env.BROKER_PUSH_LOCK_DIR ??= mkdtempSync(join(tmpdir(), 'push-locks-'));

const made = new Set();

// Stop a daemon holding `dir`'s broker lock; `dir` is always a fixture this process created.
function killDaemonOf(dir) {
  try {
    const pid = JSON.parse(readFileSync(join(dir, 'target', 'broker', 'broker.lock'), 'utf8')).pid;
    if (!pid || pid === process.pid) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    else process.kill(pid);
  } catch { /* no lock, or already gone */ }
}

export function cleanup(dir) {
  killDaemonOf(dir);
  made.delete(dir);
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 15, retryDelay: 200 });
  } catch {
    /* best effort on Windows file locks */
  }
}

// Fixtures a test forgot (or failed before) to clean are removed, daemon included, at exit.
process.on('exit', () => { for (const dir of [...made]) cleanup(dir); });

export function tempDir(prefix = 'broker-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.add(dir);
  return dir;
}

// A repo on `main` with target/ gitignored (so the broker's own control files never dirty it)
// and one committed file. Local identity + no gpg signing + protocol.file for local submodules.
export function makeRepo(dir) {
  mkdirSync(dir, { recursive: true });
  g(['-c', 'init.defaultBranch=main', 'init'], dir);
  g(['config', 'user.email', 'broker@test'], dir);
  g(['config', 'user.name', 'Broker Test'], dir);
  g(['config', 'commit.gpgsign', 'false'], dir);
  g(['config', 'core.autocrlf', 'false'], dir);
  g(['config', 'protocol.file.allow', 'always'], dir);
  writeFileSync(join(dir, '.gitignore'), 'target/\n');
  writeFileSync(join(dir, 'README'), 'base\n');
  g(['add', '-A'], dir);
  g(['commit', '-m', 'init'], dir);
  return dir;
}

// A bare origin for `repo`, with main pushed. Returns the bare path.
export function addOrigin(repo, barePath) {
  g(['-c', 'init.defaultBranch=main', 'init', '--bare', barePath], repo);
  g(['remote', 'add', 'origin', barePath], repo);
  g(['push', '-u', 'origin', 'main'], repo);
  return barePath;
}

export function commitOnMain(repo, file, content, msg = 'main change') {
  writeFileSync(join(repo, file), content);
  g(['add', '-A'], repo);
  g(['commit', '-m', msg], repo);
}

export function currentBranchOf(repo) {
  return g(['rev-parse', '--abbrev-ref', 'HEAD'], repo);
}

export function worktreeList(repo) {
  return g(['worktree', 'list'], repo);
}

export function branchList(repo) {
  return gTry(['branch', '--list'], repo);
}
