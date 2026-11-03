// cargo-lock.mjs — a Cargo.lock as a package graph, read without running cargo (KIT-T618).
//
//   readLock(file)                    -> Map<name, { local: boolean, deps: [name] }> | null when the file is absent
//                                         (local: no `source`, so a workspace member or path dependency)
//   readLockMemo(file)                -> the same graph, parsed again only when the file's mtime or size changes
//   dependentsOf(lock, names)       -> Set of every package that depends, directly or not, on one of `names` (the names included)
//   dependenciesOf(lock, names)       -> Set of every package `names` depend on, directly or not (the names included)

import { existsSync, readFileSync, statSync } from 'node:fs';

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

const memo = new Map();

/** `readLock` for a caller that reads the same file again and again: the graph is kept until the file's mtime or size changes. */
export function readLockMemo(file) {
  let stat;
  try { stat = statSync(file); } catch { memo.delete(file); return null; }
  const held = memo.get(file);
  if (held && held.mtimeMs === stat.mtimeMs && held.size === stat.size) return held.lock;
  const lock = readLock(file);
  memo.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, lock });
  return lock;
}

const reverseIndexes = new WeakMap();

function reverseOf(lock) {
  if (reverseIndexes.has(lock)) return reverseIndexes.get(lock);
  const reverse = new Map();
  for (const [name, { deps }] of lock) for (const d of deps) reverse.set(d, [...(reverse.get(d) || []), name]);
  reverseIndexes.set(lock, reverse);
  return reverse;
}

export function dependentsOf(lock, names) {
  const reverse = reverseOf(lock);
  const seen = new Set(names);
  for (const n of seen) for (const up of reverse.get(n) || []) seen.add(up);
  return seen;
}

export function dependenciesOf(lock, names) {
  const seen = new Set(names);
  for (const n of seen) for (const d of (lock.get(n) || { deps: [] }).deps) seen.add(d);
  return seen;
}
