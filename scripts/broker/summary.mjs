// summary.mjs — what the broker did while nobody was looking, as banner lines for orient
// (KIT-T276): daemon liveness, pause, the patch in flight, and the landings since the last look.
// `brokerLines(root)` returns [] when the project has never run a broker; it stamps the look.

import { existsSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, readBrokerConfig } from './config.mjs';
import { isPaused } from './control.mjs';
import { deferredLines } from './deferred.mjs';
import { readLock } from './lock.mjs';
import { readInflight } from './preimage.mjs';
import { listQueue } from './result.mjs';
import { submittedAt } from './stats.mjs';
import { rollupLine } from './metrics.mjs';

const MAX_LANDS = 10;
const MAX_DEFERRED = 4; // deferred failures listed inline; each can run to hundreds of characters
const DEFERRED_LINE_MAX = 200;
const MS_PER_MIN = 60 * 1000;

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; }
}

// A result file is written at or after its finishedAt, so one not modified since the last look
// cannot have landed since; skipping it avoids opening hundreds of old results.
const modifiedAfter = (file, since) => { try { return statSync(file).mtimeMs > since; } catch { return false; } };

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** True while a live broker daemon holds this checkout's lock. */
export function brokerLive(cfg) {
  const held = readLock(brokerPaths(cfg).lock);
  return !!held && pidAlive(held.pid);
}

const posix = (p) => String(p).split('\\').join('/');

/**
 * Orient's DISPATCH NOW block when jobs wait and no daemon is alive: nothing moves the queue until
 * someone starts one. [] otherwise, or when the operator paused the queue.
 */
export function noDaemonBlock(root, now = Date.now()) {
  const cfg = readBrokerConfig(root);
  if (!existsSync(brokerPaths(cfg).home) || brokerLive(cfg) || isPaused(cfg)) return [];
  const queued = listQueue(cfg);
  if (!queued.length) return [];
  const oldest = Math.round((now - Math.min(...queued.map((j) => submittedAt(j.id)).filter(Number.isFinite))) / MS_PER_MIN);
  const script = posix(join(import.meta.dirname, 'broker.mjs'));
  return [
    `--- DISPATCH NOW: ${queued.length} broker job(s) queued, no daemon running (oldest waiting ${oldest} min) ---`,
    `  start one now: node ${script} --root ${posix(root)} --log auto   (any submit or wait also starts one)`,
    '',
  ];
}

export function brokerLines(root, now = Date.now()) {
  const cfg = readBrokerConfig(root);
  const p = brokerPaths(cfg);
  if (!existsSync(p.home)) return [];
  const holder = brokerLive(cfg) ? readLock(brokerPaths(cfg).lock) : null;
  const origin = holder && holder.spawnedBy ? ` (spawned by ${holder.spawnedBy}${holder.log ? `; log ${holder.log}` : ''})` : '';
  const lines = [`broker: ${brokerLive(cfg) ? 'daemon live' : 'daemon not running'}${origin}${isPaused(cfg) ? ', PAUSED' : ''}`];
  const rollup = rollupLine(cfg, now);
  if (rollup) lines.push(rollup);
  const inflight = readInflight(cfg);
  if (inflight) lines.push(`  in flight: ${inflight.id} (${Math.round((now - Date.parse(inflight.startedAt)) / MS_PER_MIN)} min, tree holds its changes until it restores)`);
  const deferred = deferredLines(cfg);
  for (const l of deferred.slice(0, MAX_DEFERRED)) lines.push(`  ${l.length > DEFERRED_LINE_MAX ? `${l.slice(0, DEFERRED_LINE_MAX - 1)}…` : l}`);
  if (deferred.length > MAX_DEFERRED) lines.push(`  +${deferred.length - MAX_DEFERRED} more deferred — ${join(p.home, 'deferred.json')}`);
  const seen = join(p.home, 'last-seen');
  const since = existsSync(seen) ? statSync(seen).mtimeMs : 0;
  const landed = existsSync(p.results) ? readdirSync(p.results).filter((f) => f.endsWith('.json') && modifiedAfter(join(p.results, f), since)).map((f) => readJson(join(p.results, f)))
    .filter((r) => r && r.status === 'landed' && Date.parse(r.finishedAt) > since)
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt)) : [];
  for (const r of landed.slice(-MAX_LANDS)) lines.push(`  landed ${String(r.landed.sha).slice(0, 8)} ${r.ticket || ''} (${r.id})`);
  try { writeFileSync(seen, ''); utimesSync(seen, new Date(now), new Date(now)); } catch { /* best effort */ }
  return lines;
}
