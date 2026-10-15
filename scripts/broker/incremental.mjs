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

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
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

export function pruneIncremental(targetDir, { keepHours = KEEP_HOURS, now = Date.now(), dryRun = false } = {}) {
  let before = 0;
  let freed = 0;
  let removed = 0;
  let dirs = 0;
  const drop = (p, size) => { freed += size; removed++; if (!dryRun) rmSync(p, { recursive: true, force: true }); };
  for (const inc of incrementalDirs(targetDir)) {
    const units = readdirSync(inc, { withFileTypes: true }).filter((e) => e.isDirectory())
      .map((e) => { const p = join(inc, e.name); return { p, crate: e.name.replace(/-[^-]+$/, ''), m: statSync(p).mtimeMs, size: sizeOf(p) }; });
    dirs += units.length;
    const newest = new Map();
    for (const u of units) if (!newest.has(u.crate) || newest.get(u.crate).m < u.m) newest.set(u.crate, u);
    for (const u of units) {
      before += u.size;
      if (newest.get(u.crate) !== u && now - u.m > keepHours * MS_PER_HOUR) { drop(u.p, u.size); continue; }
      for (const s of readdirSync(u.p).filter((n) => n.endsWith('-working'))) {
        const p = join(u.p, s);
        if (now - statSync(p).mtimeMs > WORKING_STALE_MS) drop(p, sizeOf(p));
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
