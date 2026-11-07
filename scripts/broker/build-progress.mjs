// build-progress.mjs — what a running broker command is doing, read from its log and its process tree (KIT-D137).
// The checkpoint (build-checkpoint.mjs) uses it to tell a build that is progressing from one that is stalled, and to say
// what is building.
//
//   logWindow(logPath)            -> { size, text }   the log's size and its last LOG_WINDOW_BYTES (never the whole file)
//   logPhase(text)                -> { phase: 'compiling'|'testing'|'waiting'|'starting', compiled, registry, crates: [name], target, lock }
//     registry: crates compiled from a registry (a `Compiling x v1` line with no path), which a warm build does not redo;
//     waiting: cargo is blocked on a file lock (`lock` names it), held by another cargo build
//   treeOf(rows, rootPid)         -> rows of the root and everything below it
//   cpuByPid(rows)                -> Map<pid, cpuMs>
//   cpuGain(before, rows)         -> CPU ms the rows used since `before` (a new process counts all of its time)
//   isCompiler(row)               -> true for rustc, rustdoc, clippy-driver, a linker, a C compiler or a build script

import { closeSync, openSync, readSync, statSync } from 'node:fs';

const LOG_WINDOW_BYTES = 1 << 20;
const RECENT_CRATES = 3;
const COMPILING = /^\s*Compiling (\S+) v\S+( \(.*\))?\s*$/gm;
const RUNNING = /^\s*(?:Running|Doc-tests) (\S+)/gm;
const LOCK_WAIT = /^\s*Blocking waiting for file lock on (.+?)\s*$/gm;
const COMPILER = /^(rustc|rustdoc|clippy-driver|link|lld-link|rust-lld|cc|c\+\+|ld|build[-_]script.*)(\.exe)?$/i;

export function logWindow(logPath) {
  let size;
  try { size = statSync(logPath).size; } catch { return { size: 0, text: '' }; }
  const length = Math.min(size, LOG_WINDOW_BYTES);
  const buffer = Buffer.alloc(length);
  const fd = openSync(logPath, 'r');
  try { readSync(fd, buffer, 0, length, size - length); } finally { closeSync(fd); }
  return { size, text: buffer.toString('utf8') };
}

const lastIndex = (text, re) => { let at = -1; for (const m of text.matchAll(re)) at = m.index; return at; };

export function logPhase(text) {
  const rows = [...text.matchAll(COMPILING)];
  const compiled = rows.map((m) => m[1]);
  const lastCompile = lastIndex(text, COMPILING);
  const lastRun = lastIndex(text, RUNNING);
  const lastLock = lastIndex(text, LOCK_WAIT);
  const target = lastRun >= 0 ? [...text.matchAll(RUNNING)].pop()[1] : '';
  const lock = lastLock >= 0 ? [...text.matchAll(LOCK_WAIT)].pop()[1] : '';
  const phase = lastLock > Math.max(lastCompile, lastRun) ? 'waiting' : lastCompile > lastRun ? 'compiling' : lastRun >= 0 ? 'testing' : 'starting';
  const registry = rows.filter((m) => !m[2]).length;
  return { phase, compiled: compiled.length, registry, crates: [...new Set(compiled.reverse())].slice(0, RECENT_CRATES).reverse(), target, lock };
}

export function treeOf(rows, rootPid) {
  const kids = new Map();
  for (const r of rows) kids.set(r.ppid, [...(kids.get(r.ppid) || []), r]);
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const out = byPid.has(rootPid) ? [byPid.get(rootPid)] : [];
  for (const r of out) out.push(...(kids.get(r.pid) || []).filter((k) => k.pid !== r.pid));
  return out;
}

export const cpuByPid = (rows) => new Map(rows.map((r) => [r.pid, r.cpuMs || 0]));

export function cpuGain(before, rows) {
  return rows.reduce((sum, r) => sum + Math.max(0, (r.cpuMs || 0) - (before.get(r.pid) || 0)), 0);
}

export const isCompiler = (row) => COMPILER.test(row.name || '');
