// health-store.mjs — the broker's self-check state files, all in the broker home (KIT-T307).
//
//   health.json  array of { kind, since, detail, cause }; empty when healthy. Session hooks read it.
//   faults.json  faults the broker classified as its own the moment they happened: [{ kind, id, at, detail, pid, runtime }]
//   gatepass.json the last time a job's gate answered: { at, pid, runtime }; it resolves earlier gate crashes
//   lastrun.json the most recent job or idle re-check: { id, repo, kind, startedAt, endedAt, entries: [{ path, blob }] }
//                (`blob` is the pre-image the run journalled, or null when none was taken)

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runtimeTag } from '../runtime-pin.mjs';
import { ensureDirs } from './result.mjs';

const FAULT_KEEP = 20;
const file = (cfg, name) => join(ensureDirs(cfg).home, name);

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

export const healthFile = (cfg) => file(cfg, 'health.json');

export const readHealth = (cfg) => {
  const list = readJson(healthFile(cfg), []);
  return Array.isArray(list) ? list : [];
};

export function writeHealth(cfg, entries) {
  writeFileSync(healthFile(cfg), JSON.stringify(entries, null, 2));
}

/** Remember a fault the broker classified as its own: { kind, id, detail }. */
export function recordFault(cfg, fault) {
  const list = readJson(file(cfg, 'faults.json'), []);
  const kept = [...(Array.isArray(list) ? list : []), { ...fault, at: new Date().toISOString(), pid: process.pid, runtime: runtimeTag() }].slice(-FAULT_KEEP);
  writeFileSync(file(cfg, 'faults.json'), JSON.stringify(kept, null, 2));
}

/** Note that a job's gate answered: a gate crash before this is resolved. */
export function recordGatePass(cfg) {
  writeFileSync(file(cfg, 'gatepass.json'), JSON.stringify({ at: new Date().toISOString(), pid: process.pid, runtime: runtimeTag() }));
}

/** Note that a restore verified clean: a restore-mismatch before this is resolved. */
export function recordRestoreClean(cfg, at = new Date()) {
  writeFileSync(file(cfg, 'restoreclean.json'), JSON.stringify({ at: at.toISOString() }));
}

export const readRestoreClean = (cfg) => readJson(file(cfg, 'restoreclean.json'), null);

export const readGatePass = (cfg) => readJson(file(cfg, 'gatepass.json'), null);

export function recentFaults(cfg, nowMs, maxAgeMs) {
  const list = readJson(file(cfg, 'faults.json'), []);
  return (Array.isArray(list) ? list : []).filter((f) => nowMs - Date.parse(f.at) <= maxAgeMs);
}

/** Record what the last run touched: { id, repo, kind: 'job'|'recheck', startedAt, entries }. */
export function recordRun(cfg, run) {
  writeFileSync(file(cfg, 'lastrun.json'), JSON.stringify({ ...run, endedAt: new Date().toISOString() }, null, 2));
}

export const readRun = (cfg) => readJson(file(cfg, 'lastrun.json'), null);
