// live-patch.mjs — the one reliable answer to "is the maintainer's checkout patched right now?" (KIT-T698).
// With the check tree (check-tree.mjs) the live tree holds landed code only; a patch reaches it in two cases, a landing's
// write and a fallback run when the check tree is unavailable. Each marks `<broker home>/live-patched.json` for exactly that
// span and clears it in a finally; a daemon start clears a marker a crash left behind, after the journal restored the tree.
//
//   markLive(cfg, id, why) / clearLive(cfg)       write and remove the marker
//   withLive(cfg, id, why, fn)                    mark, run fn, clear
//   liveState(cfg)                                -> { patched: false } | { patched: true, id, why, since }
//   liveLine(cfg)                                 -> the one status line

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';

const file = (cfg) => join(brokerPaths(cfg).home, 'live-patched.json');

export function markLive(cfg, id, why) {
  try {
    mkdirSync(brokerPaths(cfg).home, { recursive: true });
    writeFileSync(file(cfg), JSON.stringify({ id, why, since: new Date().toISOString() }));
  } catch { /* best effort */ }
}

export const clearLive = (cfg) => rmSync(file(cfg), { force: true });

export function withLive(cfg, id, why, fn) {
  markLive(cfg, id, why);
  try { return fn(); } finally { clearLive(cfg); }
}

export function liveState(cfg) {
  try { return { patched: true, ...JSON.parse(readFileSync(file(cfg), 'utf8')) }; } catch { return { patched: false }; }
}

export function liveLine(cfg) {
  const s = liveState(cfg);
  return s.patched ? `live tree: PATCHED by ${s.id} (${s.why}) since ${String(s.since).slice(11, 19)}Z` : 'live tree: landed code only';
}
