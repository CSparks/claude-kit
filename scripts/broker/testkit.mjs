// testkit.mjs — throwaway git fixtures for the broker tests. NOT a test: it builds real, tiny
// git repos in a temp dir whose "build" commands are plain shell (node -e / echo), so the suite
// runs in seconds and needs no cargo. Every fixture is a real repo so the git protocol (path
// commits, push, submodule pin) is exercised for real, never mocked.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A Windows process that dies while initialising (0xC0000142) never ran: the machine is out of
// desktop heap or pagefile under load, and the same spawn succeeds once the pressure drops.
const PROCESS_INIT_FAILED = 3221225794;
const SPAWN_ATTEMPTS = 4;

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Run git; a failure throws with the command, status, stderr and stdout in the message.
export function g(args, cwd) {
  for (let attempt = 1; ; attempt++) {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    if (r.status === 0) return r.stdout.trim();
    // A git refusal always says why; a failure with no output at all is the spawn failing under machine load.
    const silent = r.status !== 0 && !r.error && !String(r.stderr || '').trim() && !String(r.stdout || '').trim();
    if ((r.status === PROCESS_INIT_FAILED || silent) && attempt < SPAWN_ATTEMPTS) {
      sleepMs(500 * attempt);
      continue;
    }
    const err = new Error(`git ${args.join(' ')} (cwd ${cwd}) failed, status ${r.status ?? r.error?.code}\nstderr: ${r.stderr || r.error?.message || ''}\nstdout: ${r.stdout}`);
    err.status = r.status;
    err.stderr = r.stderr;
    err.stdout = r.stdout;
    throw err;
  }
}

// Try a git command; return '' on failure (for probes like rev-parse on an empty ref).
export function gTry(args, cwd) {
  try {
    return g(args, cwd);
  } catch {
    return '';
  }
}

// Fixtures live under the canonical temp path: the 8.3 short form (CHRISS~1) and the long form
// name one directory, and git records whichever it was given.
const TMP = realpathSync.native(tmpdir());

// A hook or an outer git command exports GIT_DIR / GIT_INDEX_FILE and friends; every git the
// fixtures (and the code under test) spawn must locate its repo from cwd alone.
for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];

// A test never auto-starts a daemon (submit/wait honour this, and children inherit it).
process.env.BROKER_NO_AUTOSTART ??= '1';
process.env.BROKER_ALLOW_NON_CARGO ??= '1';
process.env.BROKER_NO_AUTOPIN ??= '1';
process.env.BROKER_LEGACY_DEFAULTS ??= '1';

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
  const dir = mkdtempSync(join(TMP, prefix));
  made.add(dir);
  return dir;
}

// Build slots are machine-wide: a test's pre-push gate would queue behind a real build on the
// box. Each test process gets its own slot directory, which its children inherit.
process.env.CLAUDE_KIT_BUILD_SLOT_DIR ??= tempDir('broker-slots-');

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
