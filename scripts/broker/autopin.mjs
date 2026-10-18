// autopin.mjs — pin every consumer on each submodule landing (KIT-T563). When a submodule commit
// reaches its remote (rapid-game), each registered checkout whose broker config marks that submodule
// `auto_pin: true` gets a pin-only job (`--pin <sub>=<sha> --no-patch --land`, KIT-T562) in its OWN
// queue through its own submit.mjs, so nothing waits across checkouts. A pin that goes red keeps the
// old gitlink and files a bug in the consumer's repo naming the break; a stale pin (the consumer
// already sits at or past the sha) is not a break.
//
//   consumersOf(repo, { projects })                  checkout roots that auto-pin `repo`
//   queueAutoPins(repo, sha, jobs, { consumers, run }) -> [root] a pin job was handed to (never throws)
//   reportRedPin(cfg, job, result, { fileBug })      -> true when a bug was filed

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRegistry } from '../../hooks/lib/registry.mjs';
import { readBrokerConfig } from './config.mjs';
import { hasTrackedCargo } from './cargo-scope.mjs';
import { fileBugViaCap } from './deferred.mjs';
import { git } from './git.mjs';
import { STATUS } from './result.mjs';

const SUBMIT = join(import.meta.dirname, 'submit.mjs');
const posix = (p) => resolve(p).split(String.fromCharCode(92)).join('/').toLowerCase();
export const remoteOf = (cwd, remote) => git(['remote', 'get-url', remote], cwd).out.replace(/\.git$/, '');
const SCRATCH = /\/\.claude\/worktrees\//;

export function consumersOf(repo, { projects = readRegistry().projects, from = null, scratch = SCRATCH } = {}) {
  const found = [];
  for (const path of new Set(Object.values(projects))) {
    if (!path || !existsSync(path) || scratch.test(`${posix(path)}/`)) continue;
    try {
      const sub = readBrokerConfig(path).repos.find((r) => r.submodule && r.name === repo.name && r.autoPin);
      if (!sub || !hasTrackedCargo(path)) continue;
      if (from && remoteOf(join(path, sub.path), sub.remote) !== from) continue;
      found.push(path);
    } catch { /* an unreadable project is not a consumer */ }
  }
  return found;
}

const detached = (file, args) => spawn(process.execPath, [file, ...args], { detached: true, stdio: 'ignore', windowsHide: true }).unref();

export function queueAutoPins(repo, sha, jobs, { consumers, run = detached, from } = {}) {
  const queued = [];
  if (!consumers && process.env.BROKER_NO_AUTOPIN) return queued;
  try {
    const roots = consumers || consumersOf(repo, { from });
    const ticket = (jobs.find((j) => j.ticket) || {}).ticket;
    const origin = (jobs[0] || {}).id;
    if (!ticket || !sha) return queued;
    for (const root of roots) {
      try {
        run(SUBMIT, ['--root', root, '--ticket', ticket, '--title', `pin ${repo.name} ${sha.slice(0, 10)}`, '--pin', `${repo.name}=${sha}`, '--no-patch', '--land', '--auto-pin', origin || 'landing']);
        queued.push(root);
      } catch { /* one consumer's failure never holds another */ }
    }
  } catch { /* auto-pin is best effort: the landing already succeeded */ }
  return queued;
}

export function reportRedPin(cfg, job, result, { fileBug = fileBugViaCap } = {}) {
  if (!job.autoPin || !result || [STATUS.LANDED, STATUS.STALE, STATUS.PASSED].includes(result.status)) return false;
  const pin = (job.pins || [])[0];
  const where = (result.commands || []).find((c) => c.exit !== 0);
  const why = result.message || (where ? `\`${where.cmd}\` exited ${where.exit}` : `${result.status} in ${result.phase}`);
  return fileBug({
    cwd: cfg.root, type: 'bug',
    text: `auto-pin of ${pin ? `${pin.repo} ${String(pin.sha).slice(0, 10)}` : 'the submodule'} is ${result.status} here (${why}); the gitlink stays at the old pin; job ${job.id} from ${job.autoPin}`,
  });
}
