// timing-waste.mjs — waste measured directly, not inferred from wall time (KIT-D121). A long job is not a problem;
// work the change did not need is. From a job's cargo logs and its diff:
//   rebuild  a crate compiled that neither the change touched nor depends on it (a cold or flipped cache), cost =
//            the command's compile time split over the crates it compiled
//   scope    a test run of crates the change does not reach (no touched crate is among their dependencies)
//   cache    per cargo command: a hit compiled nothing, a miss compiled something
// Dependents come from Cargo.lock (cargo-lock.mjs); a command whose graph cannot be read yields no waste entry.
//
//   `moved`: paths the base moved since the lane's last job (timing-moved.mjs); they reach crates like the job's own diff
//   wasteOf(commands, members, { bases, targetsOf, cratesOf, moved }) ->{ entries: [{ kind: 'waste', key, ms }], cache: { hits, misses } }

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dependentsOf, readLock } from './cargo-lock.mjs';
import { commandSplit } from './metrics.mjs';

export const WASTE = 'waste';
const COMPILING = /^\s*(?:Compiling|Checking)\s+(\S+)\s+v\S+/gm;
const CARGO_WORK = /\bcargo\b.*\b(?:test|t|nextest|build|check|clippy)\b/;
const RUST_PATH = /\.(?:rs|toml)$|Cargo\.lock$/;
const DIFF_PATH = /^\s*(\S.*?)\s+\|/;
const PACKAGE_NAME = /^\[package\][^[]*?^name\s*=\s*"([^"]+)"/ms;

const compiledIn = (log) => {
  try { return [...readFileSync(log, 'utf8').matchAll(COMPILING)].map((m) => m[1]); } catch { return []; }
};

const diffPaths = (members) => [...new Set(members.flatMap((m) => String(m.diffStat || '').split('\n')).map((l) => DIFF_PATH.exec(l)?.[1]).filter((p) => p && !p.startsWith('...')))];

function crateAt(file, bases) {
  for (const base of bases) {
    for (let dir = dirname(join(base, file)); dir.length > base.length; dir = dirname(dir)) {
      const manifest = join(dir, 'Cargo.toml');
      const name = existsSync(manifest) ? PACKAGE_NAME.exec(readFileSync(manifest, 'utf8'))?.[1] : null;
      if (name) return { name, dir };
    }
  }
  return null;
}

// Every Cargo.lock at or above `dir`: a nested workspace (a submodule's) and the project's own both hold dependents.
function locksAbove(dir) {
  const locks = [];
  for (let d = dir; ; d = dirname(d)) {
    const lock = readLock(join(d, 'Cargo.lock'));
    if (lock) locks.push(lock);
    if (dirname(d) === d) return locks;
  }
}

// { reach: crates the change reaches, known: false when the diff touches Rust the checkout cannot place }
function reachOf(members, bases, moved) {
  const rust = [...new Set([...diffPaths(members), ...moved])].filter((p) => RUST_PATH.test(p));
  if (!rust.length) return { reach: new Set(), known: true };
  const touched = rust.map((p) => crateAt(p, bases)).filter(Boolean);
  const locks = [...touched.map((t) => t.dir), ...bases].flatMap(locksAbove);
  if (!touched.length || !locks.length) return { reach: new Set(), known: false };
  const names = touched.map((t) => t.name);
  return { reach: new Set(locks.flatMap((lock) => [...dependentsOf(lock, names)])), known: true };
}

export function wasteOf(commands, members, { bases, cratesOf, targetsOf, moved = [] }) {
  const { reach, known } = reachOf(members, bases, moved);
  const entries = new Map();
  const add = (key, ms) => { if (ms > 0) entries.set(key, { kind: WASTE, key, ms: (entries.get(key)?.ms || 0) + ms }); };
  const cache = { hits: 0, misses: 0 };
  for (const c of commands) {
    if (!c.log || !CARGO_WORK.test(c.cmd)) continue;
    const compiled = compiledIn(c.log);
    if (compiled.length) cache.misses += 1; else cache.hits += 1;
    const named = cratesOf(c.cmd);
    if (known && compiled.length) {
      const wasted = compiled.filter((name) => !reach.has(name) && !named.includes(name));
      for (const name of wasted) add(`rebuild ${name}`, commandSplit(c).build / compiled.length);
    }
    const ranTests = /\b(?:test|t|nextest)\b/.test(c.cmd);
    const namedOnly = named.every((n) => !n.startsWith('('));
    if (known && reach.size && ranTests && namedOnly && named.every((n) => !reach.has(n))) add(`scope ${named.join(',')} ${targetsOf(c.cmd).join(' ')}`, (c.slotWaitMs || 0) + (c.durationMs || 0));
  }
  return { entries: [...entries.values()], cache };
}
