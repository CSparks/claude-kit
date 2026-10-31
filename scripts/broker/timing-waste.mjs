// timing-waste.mjs — waste measured directly, not inferred from wall time (KIT-D121). A long job is not a problem;
// work the change did not need is. From a job's cargo logs and its diff:
//   rebuild  a crate compiled that neither the change touched nor depends on it (a cold or flipped cache), cost =
//            the command's compile time split over the crates it compiled
//   repeat   the same, for a crate an earlier command of the job already compiled; keyed by the cause (check->test,
//            same or different flags) so the ranking shows which command pairs throw the work away
//   scope    a test run of crates the change does not reach (no touched crate is among their dependencies)
//   flagged  the same commands, keyed '<crates> <targets> passed|failed' (KIT-Q005 lever 2): the data an auto-skip needs
//   cache    per cargo command: a hit compiled nothing, a miss compiled something
// Dependents come from Cargo.lock (cargo-lock.mjs); a command whose graph cannot be read yields no waste entry.
//
//   `moved`: paths the base moved since the lane's last job (timing-moved.mjs); they reach crates like the job's own diff
//   wasteOf(commands, members, { bases, targetsOf, cratesOf, moved }) ->{ entries: [{ kind: 'waste' | 'flagged', key, ms }], cache: { hits, misses } }

import { readFileSync } from 'node:fs';
import { commandSplit } from './metrics.mjs';
import { outsideReach, reachOf } from './timing-reach.mjs';

export const WASTE = 'waste';
export const FLAGGED = 'flagged';
const COMPILING = /^\s*(?:Compiling|Checking)\s+(\S+)\s+v\S+/gm;
const CARGO_WORK = /\bcargo\b.*\b(?:test|t|nextest|build|check|clippy)\b/;

const compiledIn = (log) => {
  try { return [...readFileSync(log, 'utf8').matchAll(COMPILING)].map((m) => m[1]); } catch { return []; }
};

const subOf = (cmd) => (/\bcheck\b/.test(cmd) ? 'check' : /\b(?:build|--no-run)\b/.test(cmd) ? 'build' : 'test');
const flagsOf = (cmd) => (String(cmd).match(/--features \S+|--workspace|-p \S+|--all-targets|--profile \S+|--release/g) || []).sort().join(' ');

// Why a crate compiled twice in one job: the earlier and the later command's kind and whether their flags matched.
const causeOf = (before, now) => `${subOf(before)}->${subOf(now)} ${flagsOf(before) === flagsOf(now) ? 'same' : 'different'} flags`;

export function wasteOf(commands, members, { bases, cratesOf, targetsOf, moved = [] }) {
  const state = reachOf(members, bases, moved);
  const entries = new Map();
  const add = (kind, key, ms) => { if (ms > 0) entries.set(`${kind}\0${key}`, { kind, key, ms: (entries.get(`${kind}\0${key}`)?.ms || 0) + ms }); };
  const cache = { hits: 0, misses: 0 };
  const compiledBefore = new Map();
  for (const c of commands) {
    if (!c.log || !CARGO_WORK.test(c.cmd)) continue;
    const compiled = compiledIn(c.log);
    if (compiled.length) cache.misses += 1; else cache.hits += 1;
    const named = cratesOf(c.cmd);
    if (state.known && compiled.length) {
      const wasted = compiled.filter((name) => !state.reach.has(name) && !named.includes(name));
      for (const name of wasted) add(WASTE, compiledBefore.has(name) ? `repeat ${causeOf(compiledBefore.get(name), c.cmd)}` : `rebuild ${name}`, commandSplit(c).build / compiled.length);
    }
    for (const name of compiled) compiledBefore.set(name, c.cmd);
    if (outsideReach(c.cmd, state)) {
      const spent = (c.slotWaitMs || 0) + (c.durationMs || 0);
      const target = `${named.join(',')} ${targetsOf(c.cmd).join(' ')}`;
      add(WASTE, `scope ${target}`, spent);
      add(FLAGGED, `${target} ${c.exit === 0 ? 'passed' : 'failed'}`, spent);
    }
  }
  return { entries: [...entries.values()], cache };
}
