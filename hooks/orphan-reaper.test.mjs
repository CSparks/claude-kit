// orphan-reaper (KIT-T697, KIT-T633, KIT-T634): tail/grep watchers whose parent shell is dead are ended;
// a watcher with a live parent is never touched. Real processes prove it where `tail` exists.
// Run: node hooks/orphan-reaper.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { HOOKS, ENV, cleanup, reporter, tmpDir } from './test-harness.mjs';
import { homedir, tmpdir } from 'node:os';
import { orphansOf, reapOrphans } from './lib/process-reaper.mjs';
import { lastReapMs, reapStampPath } from './lib/reap-state.mjs';

const { ok, done } = reporter('orphan-reaper');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function dies(pid, ms = 8000) {
  for (let t = 0; t < ms; t += 200) { if (!alive(pid)) return true; await wait(200); }
  return false;
}

try {
  const proc = (pid, ppid, name, started = 100) => ({ pid, ppid, name, started, command: `${name} -F x` });
  const table = [proc(1, 0, 'init', 1), proc(10, 1000, 'tail.exe'), proc(11, 20, 'grep.exe'), proc(20, 1, 'bash.exe', 50), proc(12, 21, 'tail.exe', 100), proc(21, 1, 'bash.exe', 500), proc(13, 20, 'sleep.exe')];
  const pids = orphansOf(table).map((p) => p.pid);
  ok('a watcher whose parent pid is gone is an orphan', pids.includes(10));
  ok('a watcher whose parent pid was reused by a younger process is an orphan', pids.includes(12));
  ok('negative: a watcher with a live, older parent is not an orphan', !pids.includes(11));
  ok('negative: a non-watcher with a dead parent is not touched', !orphansOf([proc(14, 999, 'node.exe')]).length);

  const killed = [];
  const r = reapOrphans({ list: () => table, kill: (pid) => killed.push(pid) });
  ok('reapOrphans kills only the orphans and counts them in one line', killed.join() === '10,12' && r.reaped.length === 2 && /ended 2 orphaned shell watcher\(s\) \(tail\)/.test(r.line));
  ok('an unreadable process table reaps nothing', reapOrphans({ list: () => { throw new Error('no ps'); } }).reaped.length === 0);

  const saved = { dir: process.env.CLAUDE_KIT_REAP_STAMP_DIR, home: process.env.CLAUDE_HOME };
  delete process.env.CLAUDE_KIT_REAP_STAMP_DIR;
  delete process.env.CLAUDE_HOME;
  const stampPath = reapStampPath();
  Object.assign(process.env, Object.fromEntries(Object.entries({ CLAUDE_KIT_REAP_STAMP_DIR: saved.dir, CLAUDE_HOME: saved.home }).filter(([, v]) => v !== undefined)));
  ok('the default stamp lives under the user home, not a shared temp dir', stampPath.startsWith(homedir()) && !stampPath.startsWith(tmpdir()));
  const stampFile = join(tmpDir('reaper-future-'), 'stamp');
  writeFileSync(stampFile, String(Date.now() + 3600000));
  ok('a stamp dated in the future is ignored', lastReapMs(stampFile) === 0);
  writeFileSync(stampFile, String(Date.now() - 1000));
  ok('negative control: a past stamp is honoured', lastReapMs(stampFile) > 0);

  const hasTail = spawnSync('tail', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasTail) {
    ok('real-process tests skipped: no tail on PATH', true);
  } else {
    const dir = tmpDir('reaper-');
    const deadLog = join(dir, 'dead-parent.log');
    const liveLog = join(dir, 'live-parent.log');
    writeFileSync(deadLog, '');
    writeFileSync(liveLog, '');
    const middle = spawnSync(process.execPath, ['-e', `const c=require('node:child_process').spawn('tail',['-n','0','-F',${JSON.stringify(deadLog)}],{detached:true,stdio:'ignore'});c.unref();console.log(c.pid)`], { encoding: 'utf8' });
    const deadPid = Number(middle.stdout.trim());
    const live = spawn('tail', ['-n', '0', '-F', liveLog], { stdio: 'ignore' });
    await wait(500);
    ok('fixture: both tails are running', alive(deadPid) && alive(live.pid));

    const scoped = (p) => p.pid === deadPid;
    const real = reapOrphans({ only: scoped });
    ok('the tail whose parent exited is ended', real.reaped.some((x) => x.pid === deadPid) && await dies(deadPid));
    ok('negative control: the tail whose parent (this test) is alive survives the same reap', alive(live.pid) && !real.reaped.some((x) => x.pid === live.pid));

    if (process.platform === 'win32') {
      const pipeLog = join(dir, 'pipe.log');
      writeFileSync(pipeLog, '');
      const sh = spawn('bash', ['-c', 'tail -n 0 -F "$1" | grep --line-buffered zzz > /dev/null & cat /proc/$!/winpid; wait', 'sh', pipeLog], { stdio: ['ignore', 'pipe', 'ignore'] });
      const grepPid = await new Promise((resolve) => { sh.stdout.once('data', (d) => resolve(Number(String(d).trim()))); });
      await wait(500);
      reapOrphans();
      ok('negative control: a live bash pipeline (tail -F | grep, dead Win32 stub parents) survives an unscoped reap', Number.isFinite(grepPid) && alive(grepPid) && alive(sh.pid));
      sh.kill();
      spawnSync('taskkill', ['/PID', String(grepPid), '/F'], { stdio: 'ignore' });
    }

    live.kill();
  }

  const stampDir = tmpDir('reaper-stamp-');
  const hookEnv = { ...ENV, CLAUDE_KIT_REAP_STAMP_DIR: stampDir };
  const stamp = join(stampDir, 'orphan-reaper.stamp');
  const event = (name) => spawnSync(process.execPath, [join(HOOKS, 'orphan-reaper.mjs')], { input: JSON.stringify({ hook_event_name: name }), encoding: 'utf8', env: hookEnv });
  const setStamp = (agoMs) => writeFileSync(stamp, String(Date.now() - agoMs));
  const stampValue = () => readFileSync(stamp, 'utf8');

  setStamp(1000);
  writeFileSync(join(stampDir, 'orphan-reaper.report'), ['orphan-reaper: ended 3 orphaned shell watcher(s) (tail/grep) whose parent had exited', 'runaway-process: ended 1 runaway process tree(s) (python) left by Bash-tool shells'].join('\n'));
  const first = event('SessionStart');
  ok('SessionStart prints the last detached run report, one line per reaper', first.status === 0 && /ended 3 orphaned/.test(first.stdout) && /ended 1 runaway/.test(first.stdout));
  ok('the report is printed once', event('SessionStart').stdout === '');

  const before = stampValue();
  ok('negative control: a fresh stamp throttles Stop (no new run, silent)', event('Stop').stdout === '' && stampValue() === before);
  setStamp(2 * 60000);
  const staleBefore = stampValue();
  ok('a PostToolUse 2 minutes after a run is still throttled (5 minute floor)', event('PostToolUse').status === 0 && stampValue() === staleBefore);
  ok('a SubagentStop after the floor starts a run and re-stamps', (() => { setStamp(6 * 60000); const old = stampValue(); event('SubagentStop'); return stampValue() !== old; })());

  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const wired = (event) => (wiring.hooks[event] || []).some((e) => e.hooks.some((h) => h.command.includes('orphan-reaper.mjs')));
  ok('wired into SessionStart, Stop, SubagentStop and PostToolUse', ['SessionStart', 'Stop', 'SubagentStop', 'PostToolUse'].every(wired));
} finally {
  cleanup();
}

done();
