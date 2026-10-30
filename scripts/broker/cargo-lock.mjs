// cargo-lock.mjs — a Cargo.lock as a package graph, read without running cargo (KIT-T618).
//
//   readLock(file)                    -> Map<name, { local: boolean, deps: [name] }> | null when the file is absent
//                                         (local: no `source`, so a workspace member or path dependency)
//   dependentsOf(lock, names)         -> Set of every package that depends, directly or not, on one of `names` (the names included)
//   dependenciesOf(lock, names)       -> Set of every package `names` depend on, directly or not (the names included)

import { existsSync, readFileSync } from 'node:fs';

const BLOCK = /^\[\[package\]\]\s*$/m;
const DEP = /"([^"\s]+)(?:\s[^"]*)?"/g;

export function readLock(file) {
  if (!existsSync(file)) return null;
  const lock = new Map();
  for (const block of readFileSync(file, 'utf8').split(BLOCK).slice(1)) {
    const name = (block.match(/^name = "([^"]+)"/m) || [])[1];
    if (!name) continue;
    const deps = (block.match(/^dependencies = \[([^\]]*)\]/m) || [, ''])[1];
    lock.set(name, { local: !/^source = /m.test(block), deps: [...deps.matchAll(DEP)].map((m) => m[1]) });
  }
  return lock;
}

export function dependentsOf(lock, names) {
  const reverse = new Map();
  for (const [name, { deps }] of lock) for (const d of deps) reverse.set(d, [...(reverse.get(d) || []), name]);
  const seen = new Set(names);
  for (const n of seen) for (const up of reverse.get(n) || []) seen.add(up);
  return seen;
}

export function dependenciesOf(lock, names) {
  const seen = new Set(names);
  for (const n of seen) for (const d of (lock.get(n) || { deps: [] }).deps) seen.add(d);
  return seen;
}
