// run-pulsing.mjs — a blocking process run that keeps the daemon's heartbeat fresh (KIT-T493).
// The landing's git calls (commit, the repo's pre-push gate, push) can run repo hooks for many
// minutes; a plain spawnSync freezes the daemon's beat and the stall watchdog reads a healthy
// landing as wedged. The process runs as a child (run-child.mjs) writing to `logPath` while this
// side sleeps in short steps and calls pulse().
//
// `runPulsing(argv, { cwd, env, logPath, stdinPath, pollMs })` → { status, out } (out = the log text).

import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pulse } from './stall.mjs';

const CHILD = join(import.meta.dirname, 'run-child.mjs');
const DEFAULT_POLL_MS = 50;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function runPulsing(argv, { cwd, env = process.env, logPath, stdinPath = null, pollMs = DEFAULT_POLL_MS }) {
  const marker = `${logPath}.exit`;
  rmSync(marker, { force: true });
  const out = openSync(logPath, 'w');
  const input = stdinPath ? openSync(stdinPath, 'r') : 'ignore';
  try {
    spawn(process.execPath, [CHILD, marker, '--argv', JSON.stringify(argv)], { cwd, env, windowsHide: true, stdio: [input, out, out] }).unref();
  } finally {
    closeSync(out);
    if (stdinPath) closeSync(input);
  }
  while (!existsSync(marker)) { pulse(); sleep(pollMs); }
  const status = Number(readFileSync(marker, 'utf8'));
  rmSync(marker, { force: true });
  return { status, out: existsSync(logPath) ? readFileSync(logPath, 'utf8') : '' };
}
