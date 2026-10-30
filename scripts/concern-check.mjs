#!/usr/bin/env node
// concern-check.mjs — a game doing a job its framework owns (KIT-T423). The framework declares
// ownership in <framework>/docs/CHOICES.toml: a [[choice]] row naming `concern`, `crate` and
// `primitives = [...]`, the calls only that crate should make. Each primitive is searched in the
// q code index; a hit in a non-test game file (outside the framework tree, not *_tests.rs, not
// under tests/) is the game doing that concern locally. Fails open: no map, no primitives field
// or no index means no findings.
//
//   readOwnership(frameworkDir)          -> [{ concern, crate, primitives }]  rows with primitives
//   isGameFile(rel, frameworkPrefixes)   -> bool
//   concernFindings(root, deps?)         -> [{ concern, crate, files: [{ path, lines }], tickets }]
//   findingLine(finding, maxLocs?)       -> the one-line report
//   concernBlock(root, deps?)            -> orient lines, at most BLOCK_MAX
//                                           and, after it, bypassBlock's lines and framework-profile's profileBlock lines
//   bypassBlock(root, deps?)             -> the same for a `bypass = [...]` row: a game skipping a tuned framework default
//                                           (plain DefaultPlugins, no budget, position-only stream follow) instead of using the default-on builder
//
// Run: node scripts/concern-check.mjs [--root <dir>]

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isMain } from './is-main.mjs';
import { profileBlock } from './framework-profile.mjs';
import { frameworkRoots } from './q-framework.mjs';

export const BLOCK_MAX = 5;
const MAX_LOCS = 4;
const MAX_TICKETS = 3;
const CLOSED = new Set(['review', 'done', 'superseded']);
const TICKET_ID = /-T\d+$/;

const unquote = (s) => s.trim().replace(/^"(.*)"$/s, '$1').replace(/\\"/g, '"');
const stringField = (row, key) => {
  const m = new RegExp(`^${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm').exec(row);
  return m ? unquote(`"${m[1]}"`) : '';
};
const listField = (row, key) => {
  const m = new RegExp(`^${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm').exec(row);
  if (!m) return [];
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => unquote(`"${x[1]}"`)).filter(Boolean);
};

/** Rows of the framework at `frameworkDir` that list calls under `field`: `primitives` (the concern is owned) or `bypass` (a default is skipped). */
export function readOwnership(frameworkDir, field = 'primitives') {
  const file = join(frameworkDir, 'docs', 'CHOICES.toml');
  if (!existsSync(file)) return [];
  let text;
  try { text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n'); } catch { return []; }
  return text.split(/^\[\[choice\]\]\s*$/m).slice(1)
    .map((row) => ({ concern: stringField(row, 'concern'), crate: stringField(row, 'crate'), primitives: listField(row, field) }))
    .filter((r) => r.concern && r.primitives.length);
}

/** A game source file: outside every framework tree, not a test file. */
export function isGameFile(rel, frameworkPrefixes) {
  const p = rel.replace(/\\/g, '/');
  if (frameworkPrefixes.some((f) => p === f || p.startsWith(`${f}/`))) return false;
  if (/_tests\.rs$/.test(p)) return false;
  return !/(^|\/)tests\//.test(p);
}

async function defaultSearch(root, primitive) {
  const { query } = await import('./q-lib.mjs');
  const { rows } = await query('code', [primitive, '--exact', '--kind', 'code', '--limit', '0'], { cwdRoot: root });
  return rows.map((r) => r.loc).filter((loc) => /:\d+$/.test(loc));
}

async function defaultTickets(root, concern) {
  const { query } = await import('./q-lib.mjs');
  const { rows } = await query('fts', [concern], { cwdRoot: root });
  return rows.filter((r) => TICKET_ID.test(r.id || '') && !CLOSED.has(r.status)).map((r) => r.id);
}

const splitLoc = (loc) => {
  const at = loc.lastIndexOf(':');
  return { path: loc.slice(0, at), line: Number(loc.slice(at + 1)) };
};

/** Every declared concern the game also does locally, with the files and lines that do it. */
export async function concernFindings(root, { search = defaultSearch, tickets = defaultTickets, frameworks = frameworkRoots, field = 'primitives' } = {}) {
  const fws = frameworks(root);
  const prefixes = fws.map((f) => relative(root, f.dir).replace(/\\/g, '/'));
  const out = [];
  for (const fw of fws) {
    for (const row of readOwnership(fw.dir, field)) {
      const byFile = new Map();
      for (const prim of row.primitives) {
        for (const loc of await search(root, prim)) {
          const { path, line } = splitLoc(loc);
          if (!isGameFile(path, prefixes)) continue;
          if (!byFile.has(path)) byFile.set(path, new Set());
          byFile.get(path).add(line);
        }
      }
      if (!byFile.size) continue;
      const files = [...byFile].sort(([a], [b]) => a.localeCompare(b))
        .map(([path, lines]) => ({ path, lines: [...lines].sort((a, b) => a - b) }));
      let ids = [];
      try { ids = await tickets(root, row.concern); } catch { /* ticket lookup is best-effort */ }
      out.push({ concern: row.concern, crate: row.crate, files, tickets: ids.slice(0, MAX_TICKETS) });
    }
  }
  return out;
}

/** `concern "<name>" owned by <crate>; game does it locally in N files: <file:line …> open tickets: <ids>` */
export function findingLine(f, maxLocs = MAX_LOCS, { noun = 'concern', verb = 'owned', does = 'does it locally' } = {}) {
  const locs = f.files.slice(0, maxLocs).map((x) => `${x.path}:${x.lines[0]}`);
  const more = f.files.length > maxLocs ? ` +${f.files.length - maxLocs} more` : '';
  const tix = f.tickets.length ? f.tickets.join(' ') : 'none';
  return `${noun} "${f.concern}" ${verb} by ${f.crate}; game ${does} in ${f.files.length} file${f.files.length === 1 ? '' : 's'}: ${locs.join(' ')}${more} open tickets: ${tix}`;
}

/** `default "<name>" kept by <crate>; game bypasses it in N files: <file:line …> open tickets: <ids>` */
export function bypassLine(f, maxLocs = MAX_LOCS) {
  return findingLine(f, maxLocs, { noun: 'default', verb: 'kept', does: 'bypasses it' });
}

function block(found, header, line) {
  if (!found.length) return [];
  const room = BLOCK_MAX - 1;
  const shown = found.length > room ? found.slice(0, room - 1) : found;
  const lines = [header, ...shown.map((f) => `  ${line(f)}`)];
  if (shown.length < found.length) lines.push(`  +${found.length - shown.length} more concern(s) — node <kit>/scripts/concern-check.mjs`);
  return lines;
}

const OWNS_HEADER = '--- FRAMEWORK OWNS THIS: the game does a declared framework concern locally (move it to the owning crate) ---';
const BYPASS_HEADER = '--- FRAMEWORK DEFAULT BYPASSED: the game skips a tuned framework default (use the default-on builder, opt out explicitly) ---';

/** A game skipping a framework default (a `bypass = [...]` row in CHOICES.toml): header plus findings, at most BLOCK_MAX lines. */
export async function bypassBlock(root, deps) {
  return block(await concernFindings(root, { ...deps, field: 'bypass' }), BYPASS_HEADER, bypassLine);
}

/** The orient lines: the concerns the game does locally, the framework defaults it bypasses, then its missing dev fast tier; the first two blocks are at most BLOCK_MAX lines. */
export async function concernBlock(root, deps) {
  const blocks = [
    block(await concernFindings(root, deps), OWNS_HEADER, findingLine),
    await bypassBlock(root, deps),
    await profileBlock(root, deps),
  ].filter((b) => b.length);
  return blocks.flatMap((b, i) => (i ? ['', ...b] : b));
}

async function main(argv) {
  const at = argv.indexOf('--root');
  const root = at >= 0 ? argv[at + 1] : process.cwd();
  let found = [];
  try { found = await concernFindings(root); } catch (e) { process.stderr.write(`concern-check: ${e.message} (fail-open)\n`); }
  for (const f of found) console.log(findingLine(f, Infinity));
  if (!found.length) console.log('concern-check: no declared framework concern is done locally by the game.');
}

if (isMain(import.meta.url)) await main(process.argv.slice(2));
