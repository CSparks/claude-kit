// runtime-holders.mjs — runtime copies a live broker still runs from, found through the broker
// locks of every registered checkout (KIT-T486). A daemon started before runtime pins existed
// never pinned; its lock still has a live pid and the time it started, and the copy `current`
// pointed at then is the newest sha directory created before that time. A lock that records its
// `runtime` names it outright.
//
// `heldRuntimes(runtimeRoot, { projects })` → Set of sha directory names to keep.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { readRegistry } from '../hooks/lib/registry.mjs';
import { brokerPaths, readBrokerConfig } from './broker/config.mjs';
import { readLock } from './broker/lock.mjs';

const SHA_DIR = /^[0-9a-f]{7,40}$/;

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

function liveLocks(projects) {
  const out = [];
  for (const root of Object.values(projects)) {
    if (typeof root !== 'string' || !existsSync(join(root, '.ai'))) continue;
    const lock = readLock(brokerPaths(readBrokerConfig(root)).lock);
    if (lock && lock.host === hostname() && Number.isInteger(lock.pid) && alive(lock.pid)) out.push(lock);
  }
  return out;
}

export function heldRuntimes(runtimeRoot, { projects = readRegistry().projects } = {}) {
  const dirs = readdirSync(runtimeRoot).filter((n) => SHA_DIR.test(n))
    .map((n) => ({ n, t: statSync(join(runtimeRoot, n)).mtimeMs })).sort((a, b) => b.t - a.t);
  const keep = new Set();
  for (const lock of liveLocks(projects)) {
    if (lock.runtime && SHA_DIR.test(lock.runtime)) { keep.add(lock.runtime); continue; }
    const started = Date.parse(lock.ts);
    const then = dirs.find((d) => d.t <= started);
    if (then) keep.add(then.n);
  }
  return keep;
}
