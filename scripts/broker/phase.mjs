// phase.mjs — which phase a job is in and how long each took (KIT-T490, KIT-T491). The daemon
// enters a phase (apply, gate, run, commit, pre-push gate, rebase, reverify, push, pin); the
// current one goes to `<broker home>/phase.json` for wait's heartbeat, and the finished list
// becomes the result's `timings: [{ phase, ms }]`.
//
// `phaseTracker(cfg, id)` → { enter(name), timings(), snapshot() }; snapshot reads the timings so far without closing the phase.  `readPhase(cfg)` → { id, phase, since } | null.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';

const file = (cfg) => join(brokerPaths(cfg).home, 'phase.json');

export function readPhase(cfg) {
  try { return JSON.parse(readFileSync(file(cfg), 'utf8')); } catch { return null; }
}

export function phaseTracker(cfg, id) {
  const done = [];
  let current = null;
  const close = (now) => { if (current) done.push({ phase: current.phase, ms: now - current.at }); };
  return {
    enter(phase) {
      const now = Date.now();
      close(now);
      current = { phase, at: now };
      try { writeFileSync(file(cfg), JSON.stringify({ id, phase, since: new Date(now).toISOString() })); } catch { /* best effort */ }
    },
    snapshot() {
      return current ? [...done, { phase: current.phase, ms: Date.now() - current.at }] : done.slice();
    },
    timings() {
      close(Date.now());
      current = null;
      return done.slice();
    },
  };
}
