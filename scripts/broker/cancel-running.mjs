// cancel-running.mjs — `broker cancel <id> --running` (KIT-T676): the operator asks the daemon to kill
// the command tree of the job it is running. The CLI writes a marker naming the job; the daemon's
// command poll (run-abort.mjs) reads it, kills the tree, and the job ends `cancelled`. A job in its
// landing phases (commit, push, pin) is never cancelled: a kill there would strand the commit.
//
//   requestCancel(cfg, id)   -> { ok, error? }   writes the marker for a job the daemon is running
//   pendingCancel(cfg)       -> the job ids to cancel now, or null (marker names no running job, or it is landing)
//   cancelRunning(cfg, id, { waitMs }) -> { ok, text }   requests the cancel and waits for the job's result
//   clearCancel(cfg)         drops a leftover marker (the daemon does so at each drain)

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { inflightHas, readInflight } from './preimage.mjs';
import { readResult } from './result.mjs';
import { landingHold } from './stall.mjs';

const marker = (cfg) => join(brokerPaths(cfg).home, 'cancel-running.json');

export function requestCancel(cfg, id) {
  const running = readInflight(cfg);
  if (!inflightHas(running, id)) return { ok: false, error: `${id} is not running` };
  const held = landingHold(cfg);
  if (held) return { ok: false, error: `${id} cannot be cancelled: ${held}` };
  writeFileSync(marker(cfg), JSON.stringify({ id, at: new Date().toISOString() }));
  return { ok: true };
}

export function pendingCancel(cfg) {
  if (!existsSync(marker(cfg))) return null;
  let asked;
  try { asked = JSON.parse(readFileSync(marker(cfg), 'utf8')); } catch { return null; }
  if (!inflightHas(readInflight(cfg), asked.id) || landingHold(cfg)) return null;
  return [asked.id];
}

const POLL_MS = 200;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function cancelRunning(cfg, id, { waitMs = 30000 } = {}) {
  const asked = requestCancel(cfg, id);
  if (!asked.ok) return { ok: false, text: asked.error };
  for (const end = Date.now() + waitMs; Date.now() < end; sleep(POLL_MS)) {
    const done = readResult(cfg, id);
    if (done) return { ok: true, text: `cancelled running ${id} (${done.status}${done.message ? `: ${done.message}` : ''})` };
  }
  return { ok: true, text: `cancel of running ${id} requested; the daemon kills its command tree at the next poll` };
}

export const clearCancel = (cfg) => rmSync(marker(cfg), { force: true });
