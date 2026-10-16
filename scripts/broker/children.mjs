// children.mjs — the command trees a daemon started, recorded so the daemon that replaces it after
// a hard kill can end the ones still running and keep their logs (KIT-T549). Without this a dead
// daemon's cargo child keeps the build directory locked ("Blocking waiting for file lock") and the
// re-run overwrites the log of the run it replaced.
//
//   setChildRegistry(file)            the daemon registers its registry file; without one nothing is recorded
//   trackChild(rec) / untrackChild(pid)   rec = { pid, marker, logPath, cmd }; marker = the child's exit marker file
//   killTree(pid)                     end a process and everything it started
//   reapOrphans(file)                 -> [{ pid, cmd, log, interrupted }]: ends each recorded child of a dead
//                                     daemon that has not finished and copies its log to <name>.interrupted.log;
//                                     the original stays for test-record.mjs to resume from, until the re-run overwrites it

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';

let registry = null;
export const setChildRegistry = (file) => { registry = file; };

const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e && e.code === 'EPERM'; }
};
const readAll = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return []; } };
const writeAll = (file, rows) => {
  if (rows.length) writeFileSync(file, JSON.stringify(rows, null, 2));
  else rmSync(file, { force: true });
};

export function trackChild({ pid, marker, logPath, cmd }) {
  if (!registry || !pid) return;
  writeAll(registry, [...readAll(registry).filter((r) => r.pid !== pid), { pid, daemon: process.pid, host: hostname(), marker, logPath, cmd: String(cmd).slice(0, 300), at: new Date().toISOString() }]);
}

export function untrackChild(pid) {
  if (!registry) return;
  writeAll(registry, readAll(registry).filter((r) => r.pid !== pid));
}

export function killTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } } }
}

function keepLog(logPath) {
  if (!logPath || !existsSync(logPath)) return null;
  const stem = logPath.replace(/\.log$/, '');
  let target = `${stem}.interrupted.log`;
  for (let n = 2; existsSync(target); n++) target = `${stem}.interrupted-${n}.log`;
  copyFileSync(logPath, target);
  return target;
}

/** A recorded child of a daemon that is no longer running: ended unless it finished, its log kept. */
export function reapOrphans(file) {
  const reaped = [];
  const keep = [];
  for (const rec of readAll(file)) {
    if (rec.host !== hostname() || alive(rec.daemon)) { keep.push(rec); continue; }
    if (rec.marker && existsSync(rec.marker)) continue;
    if (alive(rec.pid)) killTree(rec.pid);
    reaped.push({ pid: rec.pid, cmd: rec.cmd, log: rec.logPath, interrupted: keepLog(rec.logPath) });
  }
  writeAll(file, keep);
  return reaped;
}
