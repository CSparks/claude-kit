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

const MAX_LANDS = 10;
const MS_PER_MIN = 60 * 1000;

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; }
}

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** True while a live broker daemon holds this checkout's lock. */
export function brokerLive(cfg) {
  const held = readLock(brokerPaths(cfg).lock);
  return !!held && pidAlive(held.pid);
}

export function brokerLines(root, now = Date.now()) {
  const cfg = readBrokerConfig(root);
  const p = brokerPaths(cfg);
  if (!existsSync(p.home)) return [];
  const lines = [`broker: ${brokerLive(cfg) ? 'daemon live' : 'daemon not running'}${isPaused(cfg) ? ', PAUSED' : ''}`];
  const inflight = readInflight(cfg);
  if (inflight) lines.push(`  in flight: ${inflight.id} (${Math.round((now - Date.parse(inflight.startedAt)) / MS_PER_MIN)} min, tree holds its changes until it restores)`);
  lines.push(...deferredLines(cfg).map((l) => `  ${l}`));
  const seen = join(p.home, 'last-seen');
  const since = existsSync(seen) ? statSync(seen).mtimeMs : 0;
  const landed = existsSync(p.results) ? readdirSync(p.results).filter((f) => f.endsWith('.json')).map((f) => readJson(join(p.results, f)))
    .filter((r) => r && r.status === 'landed' && Date.parse(r.finishedAt) > since)
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt)) : [];
  for (const r of landed.slice(-MAX_LANDS)) lines.push(`  landed ${String(r.landed.sha).slice(0, 8)} ${r.ticket || ''} (${r.id})`);
  try { writeFileSync(seen, ''); utimesSync(seen, new Date(now), new Date(now)); } catch { /* best effort */ }
  return lines;
}
