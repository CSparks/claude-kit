#!/usr/bin/env node
// compat-run-limit.test.mjs — KIT-T1289: a hook run through compat-run never outlives its limit.
// An unwritten stdin, a hung or spinning hook and a normal hook run through a temp copy of the launcher.
// Run: node hooks/compat-run-limit.test.mjs

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { HOOKS, cleanup, reporter, tmpDir } from './test-harness.mjs';
import { DEFAULT_LIMIT_MS, LONG_LIMIT_MS, hookLimitMs } from './lib/hook-limits.mjs';

const { ok, done } = reporter('compat-run-limit');

const LIMIT_MS = 1500;
const OUTER_MS = 20000;
const NEAR_ZERO_CPU_MS = 1000;
const FAST_EXIT_MS = 8000;
const LIB_FILES = ['excluded-trees.mjs', 'registry.mjs', 'hook-limits.mjs'];

function makeHooksDir() {
  const dir = join(tmpDir('kit-limit-'), 'hooks');
  mkdirSync(join(dir, 'lib'), { recursive: true });
  for (const f of ['compat-run.mjs', 'compat-core.mjs']) copyFileSync(join(HOOKS, f), join(dir, f));
  for (const f of LIB_FILES) copyFileSync(join(HOOKS, 'lib', f), join(dir, 'lib', f));
  return dir;
}

// Starts the launcher with an open stdin; `feed(child)` decides what reaches it. A run that outlives
// OUTER_MS is killed and reported as code null, so a missing limit fails the test instead of hanging it.
function launch(dir, hookName, feed, limit = LIMIT_MS) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const env = { ...process.env, CLAUDE_KIT_LIVE: '1', CLAUDE_KIT_HOOK_LIMIT_MS: String(limit) };
    const child = spawn(process.execPath, [join(dir, 'compat-run.mjs'), hookName], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    const killer = setTimeout(() => child.kill('SIGKILL'), OUTER_MS);
    child.on('exit', (code) => {
      clearTimeout(killer);
      resolveRun({ code, stdout, stderr, ms: Date.now() - started });
    });
    feed(child);
  });
}

const cpuMsOf = (run) => Number((run.stderr.match(/launcher cpu (\d+) ms/) || [])[1] ?? Infinity);

try {
  const dir = makeHooksDir();
  const pidFile = join(dir, 'hang.pid');
  writeFileSync(join(dir, 'fast.mjs'), "process.stdin.resume(); process.stdin.on('end', () => { console.log('fast-ok'); });\n");
  writeFileSync(join(dir, 'block.mjs'), "process.stderr.write('BLOCKED: reason\\n'); process.exit(2);\n");
  writeFileSync(join(dir, 'hang.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); for (;;) {}\n`);

  const idle = await launch(dir, 'fast.mjs', () => {});
  ok('stdin never written: exits at the limit, not before and not after', idle.ms >= LIMIT_MS - 200 && idle.ms < LIMIT_MS + FAST_EXIT_MS, `${idle.ms} ms`);
  ok('stdin never written: fails open (exit 0) and says so', idle.code === 0 && /failing open/.test(idle.stderr) && !idle.stdout, `${idle.code} ${idle.stderr}`);
  ok('stdin never written: no busy loop, launcher cpu stays near zero', cpuMsOf(idle) < NEAR_ZERO_CPU_MS, `${cpuMsOf(idle)} ms cpu`);

  const early = await launch(dir, 'fast.mjs', (child) => child.stdin.end(), LONG_LIMIT_MS);
  ok('stdin closed at once: the hook runs and the launcher exits at once', early.code === 0 && early.stdout.trim() === 'fast-ok' && early.ms < FAST_EXIT_MS && !/failing open/.test(early.stderr), `${early.code} ${early.ms} ms ${early.stderr}`);

  const half = await launch(dir, 'fast.mjs', (child) => { child.stdin.write('{"cwd":'); setTimeout(() => child.stdin.destroy(), 200); }, LONG_LIMIT_MS);
  ok('stdin closed mid-payload: exits at once, never waits for the limit', half.code === 0 && half.ms < FAST_EXIT_MS, `${half.code} ${half.ms} ms ${half.stderr}`);

  const hung = await launch(dir, 'hang.mjs', (child) => child.stdin.end('{}'));
  ok('a spinning hook is ended at the limit', hung.ms >= LIMIT_MS - 200 && hung.ms < LIMIT_MS + FAST_EXIT_MS, `${hung.ms} ms`);
  ok('a hook that hangs fails open (exit 0) and says so', hung.code === 0 && /failing open/.test(hung.stderr), `${hung.code} ${hung.stderr}`);
  const hungPid = Number(readFileSync(pidFile, 'utf8'));
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  ok('the hung hook process is gone, not orphaned', existsSync(pidFile) && !alive(hungPid), `pid ${hungPid}`);

  const normal = await launch(dir, 'fast.mjs', (child) => child.stdin.end('{}'), LONG_LIMIT_MS);
  ok('a normal hook: output and exit unchanged', normal.code === 0 && normal.stdout.trim() === 'fast-ok' && !normal.stderr, `${normal.code} ${normal.stdout} ${normal.stderr}`);
  const blocked = await launch(dir, 'block.mjs', (child) => child.stdin.end('{}'), LONG_LIMIT_MS);
  ok('a blocking hook: exit 2 and its reason unchanged', blocked.code === 2 && /BLOCKED: reason/.test(blocked.stderr), `${blocked.code} ${blocked.stderr}`);

  ok('a gate hook gets the short default limit', hookLimitMs('pre-write.mjs', {}) === DEFAULT_LIMIT_MS);
  ok('a hook that fetches, pushes, lints or indexes declares the long limit', ['sync-data.mjs', 'framework-pin.mjs', 'lint.mjs', 'orient.mjs'].every((h) => hookLimitMs(h, {}) === LONG_LIMIT_MS));
  ok('the long limit stays under the 5-minute ceiling', LONG_LIMIT_MS < 300000);
  ok('the env override replaces both limits', hookLimitMs('lint.mjs', { CLAUDE_KIT_HOOK_LIMIT_MS: '250' }) === 250);
} finally {
  cleanup();
}
done();
