// content-align.mjs — a shared cargo target dir must not judge an artifact built from another tree's source fresh (KIT-T767, KIT-T769).
// Cargo frees a crate by mtime alone, and the live, check and lane trees of one repo overwrite each other's artifacts in place.
// A ledger per target dir and workspace holds each repo's HEAD plus the files that differ from it at the last build; before a
// build `alignSources` gives every file whose content differs from that record a fresh mtime, so cargo rebuilds exactly those crates.
//
//   alignSources(cwd, targetDir) -> { touched, error? }   never throws; the repos are cwd's repo and its checked-out submodules

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { git } from './git.mjs';

const NUL = String.fromCharCode(0);
const GITLINK_MODE = '160000';
const KEY_LENGTH = 16;
const STATUS_PREFIX = 3;
const MAX_OUTPUT = 256 * 1024 * 1024;
const SKIPPED = /^\.ai(\/|$)/;
const records = (text) => String(text).split(NUL).filter(Boolean);

function run(args, cwd, input) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, input, maxBuffer: MAX_OUTPUT });
  return { code: r.status == null ? 1 : r.status, out: r.stdout || '' };
}

function blobsOfFiles(root, paths) {
  if (!paths.length) return new Map();
  const r = run(['hash-object', '--stdin-paths'], root, `${paths.join('\n')}\n`);
  const shas = r.out.split('\n').filter(Boolean);
  return new Map(paths.map((p, i) => [p, r.code === 0 ? shas[i] : null]));
}

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** The files of `root` whose working copy differs from HEAD, as path -> blob sha (null when absent). */
function overlayOf(root) {
  const parts = records(run(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all'], root).out);
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    if (!SKIPPED.test(parts[i].slice(STATUS_PREFIX))) paths.push(parts[i].slice(STATUS_PREFIX));
    if (/[RC]/.test(parts[i].slice(0, 2))) i++;
  }
  const blobs = blobsOfFiles(root, paths.filter((p) => isFile(join(root, p))));
  return Object.fromEntries(paths.map((p) => [p, blobs.get(p) ?? null]));
}

function submodulesOf(root) {
  const staged = records(run(['ls-files', '--stage', '-z'], root).out).map((r) => r.split('\t'));
  return staged.filter(([meta]) => meta.startsWith(GITLINK_MODE)).map(([, path]) => path).filter((p) => existsSync(join(root, p, '.git')));
}

/** { '': {head, overlay}, '<submodule path>/': {head, overlay} } for the repo at `root` and its checked-out submodules. */
export function treeState(root, prefix = '') {
  const state = { [prefix]: { head: git(['rev-parse', 'HEAD'], root).out, overlay: overlayOf(root) } };
  for (const sub of submodulesOf(root)) Object.assign(state, treeState(join(root, sub), `${prefix}${sub}/`));
  return state;
}

function blobsAt(root, head, paths) {
  if (!paths.length) return new Map();
  const r = run(['cat-file', '--batch-check'], root, `${paths.map((p) => `${head}:${p}`).join('\n')}\n`);
  const lines = r.out.split('\n');
  return new Map(paths.map((p, i) => [p, r.code === 0 && /^[0-9a-f]{40,} blob /.test(lines[i] || '') ? lines[i].split(' ')[0] : null]));
}

/** Paths whose content differs between two states of one repo; null when the earlier head is unknown here. */
function differing(root, prev, next) {
  let between = [];
  if (prev.head !== next.head) {
    const d = run(['diff', '--name-only', '-z', prev.head, next.head], root);
    if (d.code !== 0) return null;
    between = records(d.out);
  }
  const paths = [...new Set([...between, ...Object.keys(prev.overlay), ...Object.keys(next.overlay)])];
  const atPrev = blobsAt(root, prev.head, paths.filter((p) => !(p in prev.overlay)));
  const atNext = blobsAt(root, next.head, paths.filter((p) => !(p in next.overlay)));
  const was = (p) => (p in prev.overlay ? prev.overlay[p] : atPrev.get(p));
  const now = (p) => (p in next.overlay ? next.overlay[p] : atNext.get(p));
  return paths.filter((p) => was(p) !== now(p));
}

function touch(root, paths, when) {
  let touched = 0;
  for (const p of paths) {
    try {
      if (!isFile(join(root, p))) continue;
      utimesSync(join(root, p), when, when);
      touched++;
    } catch { /* gone between the check and the stamp: nothing to rebuild */ }
  }
  return touched;
}

const trackedFiles = (root) => records(run(['ls-files', '-z'], root).out);

function ledgerFile(targetDir, top) {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], top).out;
  const key = createHash('sha1').update(common.toLowerCase()).digest('hex').slice(0, KEY_LENGTH);
  return join(targetDir, 'broker', 'content', `${key}.json`);
}

function readLedger(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

function writeLedger(file, state) {
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, file);
}

export function alignSources(cwd, targetDir) {
  try {
    const top = git(['rev-parse', '--show-toplevel'], cwd).out;
    if (!top) return { touched: 0 };
    const file = ledgerFile(targetDir, top);
    const next = treeState(top);
    const prev = readLedger(file);
    const when = new Date();
    let touched = 0;
    for (const [prefix, state] of Object.entries(next)) {
      if (!prev?.[prefix]) continue;
      const root = join(top, prefix);
      touched += touch(root, differing(root, prev[prefix], state) ?? trackedFiles(root), when);
    }
    writeLedger(file, { ...prev, ...next });
    return { touched };
  } catch (e) {
    return { touched: 0, error: e.message };
  }
}
