#!/usr/bin/env node
// incremental.mjs — bound rustc's incremental caches (KIT-T483). Every crate unit (lib, test
// harness, check vs build, each feature set) gets its own `<profile>/incremental/<crate>-<hash>`
// dir and none is ever removed, so the cache only grows. A dir survives when it is its crate's
// newest or was used within `keepHours`; every other one is deleted, as is a session a killed
// build left `-working`. Units that alternate (the gate's check, then its tests) stay warm.
// The daemon runs it after a suite run, with nothing building.
//
// USE: node incremental.mjs --root <checkout> [--keep-hours 24] [--dry-run]
// `pruneIncremental(targetDir, { keepHours, now, dryRun })` → { before, after, removed } (bytes, dir count).

import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBrokerConfig } from './config.mjs';

export const KEEP_HOURS = 24;
const MS_PER_HOUR = 3600 * 1000;
const WORKING_STALE_MS = MS_PER_HOUR;

function sizeOf(p) {
  let total = 0;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const f = join(p, e.name);
    try { total += e.isDirectory() ? sizeOf(f) : statSync(f).size; } catch { /* vanished */ }
  }
  return total;
}

const incrementalDirs = (targetDir) => (existsSync(targetDir) ? readdirSync(targetDir, { withFileTypes: true }) : [])
  .filter((e) => e.isDirectory() && existsSync(join(targetDir, e.name, 'incremental')))
  .map((e) => join(targetDir, e.name, 'incremental'));

// Delete incremental state: the units of `crates` (cargo names; `-`/`_` alike), or every unit when none given.
export function clearIncremental(targetDir, crates = []) {
  const want = crates.map((c) => c.replace(/-/g, '_'));
  let removed = 0;
  for (const inc of incrementalDirs(targetDir)) {
    for (const e of readdirSync(inc, { withFileTypes: true })) {
      if (!e.isDirectory() || (want.length && !want.includes(e.name.replace(/-[^-]+$/, '').replace(/-/g, '_')))) continue;
      rmSync(join(inc, e.name), { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}

const TRASH = '.trash-';
const GRACE_MS = 15 * 60 * 1000;

// Rename to a trash name, then delete: a delete that fails (locked file) leaves only the trash
// name, which the next prune sweeps, never a half-removed unit rustc could reuse.
function trash(p) {
  const t = `${p}${TRASH}${process.pid}-${Date.now()}`;
  renameSync(p, t);
  rmSync(t, { recursive: true, force: true });
}

// Newest write under a unit: the unit dir or any of its sessions.
const lastWrite = (p) => readdirSync(p, { withFileTypes: true })
  .reduce((m, e) => (e.isDirectory() ? Math.max(m, statSync(join(p, e.name)).mtimeMs) : m), statSync(p).mtimeMs);

export function pruneIncremental(targetDir, { keepHours = KEEP_HOURS, now = Date.now(), dryRun = false } = {}) {
  let before = 0;
  let freed = 0;
  let removed = 0;
  let dirs = 0;
  const drop = (p, size) => { freed += size; removed++; if (!dryRun) trash(p); };
  for (const inc of incrementalDirs(targetDir)) {
    const entries = readdirSync(inc, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of entries.filter((x) => x.name.includes(TRASH))) {
      if (!dryRun) rmSync(join(inc, e.name), { recursive: true, force: true });
    }
    for (const e of entries.filter((x) => !x.name.includes(TRASH))) {
      const p = join(inc, e.name);
      const size = sizeOf(p);
      const age = now - lastWrite(p);
      dirs++;
      before += size;
      if (age > keepHours * MS_PER_HOUR && age > GRACE_MS) { drop(p, size); continue; }
      for (const sess of readdirSync(p).filter((n) => n.endsWith('-working'))) {
        const sp = join(p, sess);
        if (now - statSync(sp).mtimeMs > WORKING_STALE_MS) drop(sp, sizeOf(sp));
      }
    }
  }
  return { before, after: before - freed, removed, dirs };
}

const GB = 1e9;
export const pruneLine = (r) => `incremental caches ${(r.before / GB).toFixed(2)} GB in ${r.dirs} dirs -> ${(r.after / GB).toFixed(2)} GB (${r.removed} removed)`;

function main(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const root = arg('--root') || process.cwd();
  const cfg = readBrokerConfig(root);
  const r = pruneIncremental(cfg.targetDir, { keepHours: Number(arg('--keep-hours') ?? KEEP_HOURS), dryRun: argv.includes('--dry-run') });
  console.log(`${argv.includes('--dry-run') ? 'dry run: ' : ''}${pruneLine(r)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
