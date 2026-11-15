// broken-crates.mjs — the per-crate "does not compile" marker of a shared checkout (KIT-T1245, KIT-T1247). A finished cargo check
// that failed in a crate's file marks that crate; a later check that passes over it clears it. The marker names the first
// error, the writer whose Edit or Write last touched the crate (read off the accepted-writes ledger, not off a live claim) and
// since when, so a blocked writer's failed check is answered with whom it waits on, `builds` lists every broken crate, and
// the writer that broke it is told once. Machine-local state beside the build slots; every path fails open.
//
//   firstError(output)                                -> "error[E0425]: cannot find value `x` (src/lib.rs:1:15)", or ''
//   packageCrates(output, scope)                      -> crate directories of the packages `could not compile` lines name, matched against
//                                                        the manifests in `scope` (survives an output filtered to error lines)
//   markBroken({ output, files, crates?, checker, trees, treeOf, now? }) -> the markers this failure wrote or refreshed for the crates
//                                                        of `files` and the crate directories `crates` inside `trees`; treeOf(file)
//                                                        is the git root of a file
//   clearCovered(scope)                               -> crates a passing check over `scope` proves compile; their markers go
//   brokenIn(scope)                                   -> live markers whose crate a check over `scope` compiles
//   readBroken(now?)                                 -> live markers, oldest first (a marker no check refreshed in EXPIRES_MS goes)
//   brokenFor(writer)                                 -> markers naming `writer` as last writer that it was not yet told of
//   markTold(marker, writer)                          -> remember `writer` heard of this marker
//   blockedText(markers, now?)                        -> what a writer whose check failed on another's crate sees
//   culpritText(markers, now?)                        -> what the writer that left the crate broken sees
//   brokenLines(markers, now?)                        -> the `builds` section
//   repairsOwnBrokenCrate({ absFile, writer })        -> true when `writer` last edited the crate of `absFile` and it is marked broken
//   leftBrokenNote({ tree, checksRoot, absFile, writer, notAfter }) -> lines for a refused edit naming every crate the writer
//                                                        edited and left unchecked or marked broken, else []

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { slotDir } from '../../scripts/broker/build-slot-store.mjs';
import { inScope } from '../../scripts/broker/cargo-scope-dirs.mjs';
import { readTurnRecords } from './turn-state.mjs';
import { liveClaimants } from './checkout-holder.mjs';
import { crateDirOf, readChecks, unverifiedCrates } from './crate-checks.mjs';
import { contentHashOf } from './shell-snapshot.mjs';
import { writerId } from './tool-writes.mjs';

const DIR_NAME = 'broken-crates';
const EXPIRES_MS = 2 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60000;
const ERROR_LINE = /^\s*(?:\S+?:\d+:\d+:\s+)?error(?:\[E\d+\])?:\s*(?!aborting|could not compile)(.+)$/;
const COULD_NOT_COMPILE = /could not compile `([^`]+)`/g;
const PACKAGE_NAME = /^\s*name\s*=\s*"([^"]+)"/m;
const SITE_LINE = /^\s*-->\s+(\S+?:\d+:\d+)/;
const slash = (p) => String(p).replace(/\\/g, '/');
const dirPath = () => join(slotDir(), DIR_NAME);
const fileOf = (crate) => join(dirPath(), `${createHash('sha1').update(slash(crate).toLowerCase()).digest('hex').slice(0, 16)}.json`);
const minutesAgo = (iso, now) => Math.max(0, Math.round((now - Date.parse(iso)) / MS_PER_MINUTE));
const clock = (iso) => String(iso).slice(11, 16);

export function firstError(output) {
  const lines = String(output || '').split(/\r?\n/);
  const at = lines.findIndex((l) => ERROR_LINE.test(l));
  if (at < 0) return '';
  const site = lines.slice(at + 1, at + 4).map((l) => l.match(SITE_LINE)).find(Boolean);
  return `${lines[at].trim()}${site ? ` (${site[1]})` : ''}`;
}

function readMarker(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function writeMarker(marker) {
  try {
    mkdirSync(dirPath(), { recursive: true });
    writeFileSync(fileOf(marker.crate), `${JSON.stringify(marker)}\n`);
  } catch { /* a marker is a courtesy */ }
}

export function readBroken(now = Date.now()) {
  let names = [];
  try { names = readdirSync(dirPath()).filter((n) => n.endsWith('.json')); } catch { return []; }
  return names.flatMap((n) => {
    const path = join(dirPath(), n);
    const m = readMarker(path);
    if (m && now - Date.parse(m.checkedAt) < EXPIRES_MS && existsSync(m.crate)) return [m];
    rmSync(path, { force: true });
    return [];
  }).sort((a, b) => String(a.since).localeCompare(String(b.since)));
}

const newest = (list) => list.reduce((a, b) => ((b.ts || 0) >= (a?.ts || 0) ? b : a), null);

/** The crate directories of the packages a check's `could not compile` lines name, found among the manifests of its `scope`. */
export function packageCrates(output, scope) {
  const names = new Set([...String(output || '').matchAll(COULD_NOT_COMPILE)].map((m) => m[1]));
  if (!names.size) return [];
  const manifests = (scope || []).filter((s) => !String(s).startsWith('!')).map((s) => (/Cargo\.toml$/i.test(s) ? s : join(s, 'Cargo.toml')));
  return [...new Set(manifests.flatMap((m) => {
    try { return names.has((readFileSync(m, 'utf8').match(PACKAGE_NAME) || [])[1]) ? [resolve(m, '..')] : []; } catch { return []; }
  }))];
}

// The writer whose edit is on disk: an entry of `file` whose recorded content hash is the file's hash now (a refused edit's
// predicted entry never matches), else the newest confirmed entry, else the newest .rs entry of the crate.
function lastWriterOf({ tree, crate, file }) {
  const entries = readTurnRecords(tree, 'toolwrites').filter((e) => e && e.w);
  const rel = file ? slash(relative(tree, file)) : '';
  const own = rel ? entries.filter((e) => e.p === rel) : [];
  const disk = rel ? contentHashOf(tree, rel) : '';
  const prefix = `${slash(relative(tree, crate))}/`;
  const inCrate = entries.filter((e) => /\.rs$/i.test(e.p || '') && slash(e.p).startsWith(prefix));
  return (newest(own.filter((e) => e.h === disk)) || newest(own.filter((e) => e.c)) || newest(inCrate.filter((e) => e.c)) || newest(own) || newest(inCrate))?.w || '';
}

function labelOf(tree, writer) {
  const hit = liveClaimants(tree).find((c) => writerId(c.session, c.agent) === writer);
  return hit ? hit.label || '' : '';
}

export function markBroken({ output, files, crates = [], checker, trees, treeOf, now = Date.now() }) {
  const error = firstError(output);
  const at = new Date(now).toISOString();
  const written = [];
  const sites = [...files.map((file) => ({ file, crate: crateDirOf(file) })), ...crates.map((crate) => ({ file: '', crate }))];
  for (const { file, crate } of sites) {
    const tree = treeOf(file || join(crate, 'Cargo.toml'));
    if (!tree || !crate || !trees.some((t) => slash(crate).toLowerCase().startsWith(slash(t).toLowerCase()))) continue;
    if (written.some((m) => m.crate === crate)) continue;
    const before = readMarker(fileOf(crate));
    const writer = lastWriterOf({ tree, crate, file }) || (before && before.writer) || '';
    const kept = before && before.writer === writer && before.error === error ? before.told : [];
    const marker = { crate, tree, error, writer, label: writer ? labelOf(tree, writer) : '', since: (before && before.since) || at, checkedAt: at, checker, told: kept || [] };
    writeMarker(marker);
    written.push(marker);
  }
  return written;
}

export function clearCovered(scope) {
  if (!scope || !scope.length) return [];
  return readBroken().filter((m) => inScope(join(m.crate, 'src', 'lib.rs'), scope)).map((m) => { rmSync(fileOf(m.crate), { force: true }); return m; });
}

export const brokenIn = (scope) => readBroken().filter((m) => inScope(join(m.crate, 'src', 'lib.rs'), scope || []));

export const brokenFor = (writer) => (writer ? readBroken().filter((m) => m.writer === writer && !(m.told || []).includes(writer)) : []);

export function markTold(marker, writer) {
  const current = readMarker(fileOf(marker.crate));
  if (current) writeMarker({ ...current, told: [...new Set([...(current.told || []), writer])] });
}

const who = (m) => (m.writer ? `${m.label ? `${m.label}, ` : ''}writer ${m.writer}` : 'a writer the kit cannot name');

export function blockedText(markers, now = Date.now()) {
  return markers.map((m) => [
    `  ${slash(m.crate)} has not compiled since ${clock(m.since)}Z (${minutesAgo(m.since, now)} min): ${m.error || 'an error'}`,
    `    last edited by ${who(m)}; it is not your edit: tell that writer or your coordinator, and check again once it lands`,
  ].join('\n')).join('\n');
}

export function culpritText(markers, now = Date.now()) {
  return [
    'A crate you edited last does not compile, and every other writer\'s cargo check and launch check fails on it (KIT-T1245):',
    ...markers.map((m) => `  ${slash(m.crate)}: ${m.error || 'an error'} (not compiling since ${clock(m.since)}Z, ${minutesAgo(m.since, now)} min; found by ${m.checker})`),
    'Fix it before any other work. If an edit of yours is refused by another writer\'s running build, run the `builds --wait` the refusal names and land it at once.',
  ].join('\n');
}

export function brokenLines(markers, now = Date.now()) {
  if (!markers.length) return ['broken crates: none'];
  return ['broken crates:', ...markers.map((m) => `  ${slash(m.crate)}  ${minutesAgo(m.since, now)} min  last edited by ${who(m)}  ${m.error || ''}`.trimEnd())];
}

const sameCrate = (a, b) => slash(a).toLowerCase() === slash(b).toLowerCase();

/** True when `writer` last edited the crate of `absFile` and a failed check marked it broken: its edit repairs it, so a build hold must not refuse it. */
export function repairsOwnBrokenCrate({ absFile, writer }) {
  try {
    const crate = crateDirOf(resolve(absFile));
    return !!crate && !!writer && readBroken().some((m) => sameCrate(m.crate, crate) && m.writer === writer);
  } catch {
    return false;
  }
}

export function leftBrokenNote({ tree, checksRoot, absFile, writer, notAfter }) {
  try {
    if (!writer) return [];
    const crates = new Map(readBroken().filter((m) => m.writer === writer).map((m) => [slash(m.crate).toLowerCase(), `does not compile (${m.error})`]));
    for (const u of unverifiedCrates({ trees: [tree], writer, checks: readChecks(checksRoot), notAfter })) {
      if (!crates.has(u.crate)) crates.set(u.crate, u.failed ? 'FAILED your last cargo check' : 'has edits of yours no cargo check has covered');
    }
    if (!crates.size) return [];
    const here = crateDirOf(resolve(absFile));
    return [
      ...[...crates].map(([crate, state]) => `  YOUR CRATE IS LEFT HALF EDITED: ${crate}${here && sameCrate(here, crate) ? ' (the crate of this edit)' : ''} ${state}; every other writer's check of it fails until your change is whole.`),
      '  This refused edit may be the one that completes your change: wait once as below, retry at once, and do nothing else meanwhile.',
    ];
  } catch {
    return [];
  }
}
