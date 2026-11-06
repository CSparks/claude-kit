// build-contention.mjs — cargo builds the broker does not own (KIT-T873, KIT-T874). The build slots serialize broker
// builds, but a hand-run `cargo check`, an editor's flycheck or another checkout's push gate still shares the machine,
// and a compile that needs 7 minutes alone ran past the 10-minute kill beside them (rustc keeps nothing of a killed
// crate). Every broker cargo build samples the foreign builds before it starts and a build killed at its limit samples
// them again, so a timeout names the builds that shared the machine (`contendedBy`). KIT-D105 makes the build slot the only
// cross-directory wait, so waiting for foreign builds is OFF: CLAUDE_KIT_CONTENTION_WAIT_MS=<ms> turns on a bounded wait
// (inside the slot, outside the command's time limit) once the decision is amended.
//
//   foreignBuilds(procs, ownPids) -> [{ pid, name, cmd }]   cargo build roots and parentless rustc not under `ownPids`
//   listProcesses() -> [{ pid, ppid, name, cmd }]           every process on this machine
//   waitForQuiet({ ownPids?, shouldCancel?, maxWaitMs?, pollMs?, list? }) -> { waitedMs, quiet, contendedBy: [summary] }
//     one sample, then waits while foreign builds run until `maxWaitMs` (default: the env value, else 0 = sample only)
//   describe(build) -> "pid 123 cargo check --workspace"

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isCargoBuild } from './cargo-subs.mjs';
import { slotDir } from './build-slot.mjs';
import { pulse } from './stall.mjs';

const WAIT_ENV = 'CLAUDE_KIT_CONTENTION_WAIT_MS';
const POLL_MS = 2000;
const SUMMARY_CHARS = 120;
const MAX_NAMED = 4;
const CARGO_FAMILY = /^(cargo|rustc|rustdoc|clippy-driver)(\.exe)?$/i;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const WINDOWS_LIST = [
  '-NoProfile', '-Command',
  'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.ParentProcessId)`t$($_.Name)`t$($_.CommandLine)" }',
];

const parseRow = (line) => {
  const [pid, ppid, name, ...rest] = line.split('\t');
  return { pid: Number(pid), ppid: Number(ppid), name: name || '', cmd: rest.join('\t') };
};

export function listProcesses() {
  try {
    if (process.platform === 'win32') {
      return execFileSync('powershell', WINDOWS_LIST, { encoding: 'utf8', windowsHide: true }).split(/\r?\n/).filter(Boolean).map(parseRow);
    }
    const out = execFileSync('ps', ['-axo', 'pid=,ppid=,comm=,args='], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean).map((l) => {
      const [pid, ppid, comm, ...args] = l.trim().split(/\s+/);
      return { pid: Number(pid), ppid: Number(ppid), name: comm.split('/').pop(), cmd: args.join(' ') };
    });
  } catch { return []; }
}

// This process and every live slot holder: the builds they started are governed by the slot queue.
export function governedPids(dir = slotDir()) {
  const pids = [process.pid];
  try {
    for (const f of readdirSync(dir).filter((n) => n.startsWith('slot-'))) {
      try { pids.push(JSON.parse(readFileSync(join(dir, f), 'utf8')).pid); } catch { /* released */ }
    }
  } catch { /* no slot dir yet */ }
  return pids.filter(Number.isInteger);
}

const bareCmd = (cmd) => String(cmd).replace(/^"[^"]*cargo(\.exe)?"/i, 'cargo').replace(/^\S*cargo(\.exe)?/i, 'cargo');

export function foreignBuilds(procs, ownPids) {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const underOwn = (p) => {
    for (let hop = 0, cur = p; cur && hop < procs.length; hop++, cur = byPid.get(cur.ppid)) {
      if (ownPids.includes(cur.pid)) return true;
    }
    return false;
  };
  const isRoot = (p) => !CARGO_FAMILY.test(byPid.get(p.ppid)?.name || '');
  return procs
    .filter((p) => CARGO_FAMILY.test(p.name) && isRoot(p) && !underOwn(p))
    .filter((p) => (/^cargo/i.test(p.name) ? isCargoBuild(bareCmd(p.cmd)) : /--crate-name\b/.test(p.cmd)))
    .map((p) => ({ pid: p.pid, name: p.name.replace(/\.exe$/i, ''), cmd: bareCmd(p.cmd) }));
}

export const describe = (b) => `pid ${b.pid} ${b.cmd.length > SUMMARY_CHARS ? `${b.cmd.slice(0, SUMMARY_CHARS)}...` : b.cmd}`;

// Names at most MAX_NAMED builds; the rest are counted.
export function summarize(builds) {
  const named = builds.slice(0, MAX_NAMED).map(describe);
  return builds.length > MAX_NAMED ? [...named, `and ${builds.length - MAX_NAMED} more`] : named;
}

const configuredWaitMs = () => Math.max(0, Number(process.env[WAIT_ENV]) || 0);

export function waitForQuiet({ ownPids, shouldCancel = () => false, maxWaitMs = configuredWaitMs(), pollMs = POLL_MS, list = listProcesses } = {}) {
  const started = Date.now();
  const own = ownPids || governedPids();
  let contendedBy = [];
  for (;;) {
    const builds = foreignBuilds(list(), own);
    if (!builds.length) return { waitedMs: Date.now() - started, quiet: true, contendedBy };
    contendedBy = summarize(builds);
    if (shouldCancel() || Date.now() - started >= maxWaitMs) return { waitedMs: Date.now() - started, quiet: false, contendedBy };
    pulse();
    sleep(pollMs);
  }
}
