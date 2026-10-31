// timing-reach.mjs — which crates a change reaches, and which test commands run beyond that (KIT-D121, KIT-Q005 lever 2).
// A crate is reached when the diff (or a path the base moved) touches it or one of its dependencies; dependents come from
// every Cargo.lock at or above the touched crate (cargo-lock.mjs).
//
//   reachOf(members, bases, moved) -> { reach: Set of crate names, known: false when the diff touches Rust the checkout cannot place }
//   reachBases(cfg)                  -> the directories diff paths are placed under
//   outsideReach(cmd, { reach, known }) -> true for a test command whose named crates the change does not reach
//   outsideReachOf(result, bases)    -> the result's commands that are outside the reach (advisory: the lane's moved paths are not known here)

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dependentsOf, readLock } from './cargo-lock.mjs';
import { cratesOf } from './timing-cmd.mjs';

const RUST_PATH = /\.(?:rs|toml)$|Cargo\.lock$/;
const DIFF_PATH = /^\s*(\S.*?)\s+\|/;
const PACKAGE_NAME = /^\[package\][^[]*?^name\s*=\s*"([^"]+)"/ms;
const TEST_COMMAND = /\b(?:test|t|nextest)\b/;

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

function locksAbove(dir) {
  const locks = [];
  for (let d = dir; ; d = dirname(d)) {
    const lock = readLock(join(d, 'Cargo.lock'));
    if (lock) locks.push(lock);
    if (dirname(d) === d) return locks;
  }
}

export function reachOf(members, bases, moved = []) {
  const rust = [...new Set([...diffPaths(members), ...moved])].filter((p) => RUST_PATH.test(p));
  if (!rust.length) return { reach: new Set(), known: true };
  const touched = rust.map((p) => crateAt(p, bases)).filter(Boolean);
  const locks = [...touched.map((t) => t.dir), ...bases].flatMap(locksAbove);
  if (!touched.length || !locks.length) return { reach: new Set(), known: false };
  const names = touched.map((t) => t.name);
  return { reach: new Set(locks.flatMap((lock) => [...dependentsOf(lock, names)])), known: true };
}

/** The directories a change's paths are placed under: the checkout root and each repo's directory. */
export const reachBases = (cfg) => [cfg.root, ...cfg.repos.map((r) => join(cfg.root, r.path || r.name))];

export function outsideReach(cmd, { reach, known }) {
  const named = cratesOf(cmd);
  return known && reach.size > 0 && TEST_COMMAND.test(cmd) && named.every((n) => !n.startsWith('(') && !reach.has(n));
}

export function outsideReachOf(result, bases) {
  const state = reachOf([result], bases);
  return (result.commands || []).filter((c) => outsideReach(c.cmd, state));
}
