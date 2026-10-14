// known-red.mjs — compile errors main already has are not the patch's (KIT-T482 item 5). When a
// command fails only on compile errors in files no patch touched, the same command runs once on
// the pre-patch tree; errors that are there too are FOREIGN and go into the known-red list, keyed
// by the tree state (HEAD plus the tracked edits, cache.mjs), so every later job on that state
// skips the baseline build. The command then runs again with the broken targets left out
// (`--keep-going` for check/build/clippy; a broken test or bin target dropped from a test
// command's selectors). A rerun whose only errors are known red counts as green for the patch.
// A landing moves HEAD and so starts a new state; the last list carries over to it when its HEAD
// is an ancestor, its files are unchanged since, and the run shows the very same error text.
//
// `foreignBuild({ cfg, cwd, entry, touched, tree, head, runBase, runAgain })` → null (not foreign:
//   the job fails as before) or { files, rerun, clean, note } for the command entry.
//   runBase(cmd) → a log path of cmd on the pre-patch tree (or null); runAgain(cmd) → a command entry.
// `knownRed(cfg, tree)` → { head, files: [path], errors: { path: [rustc block] } } | null.
// `exclude(cmd, files)` → the command with the broken targets left out, '' when nothing selected
//   is left to run, or null when it cannot leave them out.

import { readFileSync } from 'node:fs';
import { cacheGet, cachePut, hashKey } from './cache.mjs';
import { diagnose } from './diagnose.mjs';
import { git } from './git.mjs';

const NAME = 'known-red';
const LATEST = 'latest';
const UNLOCATED = '(unlocated)';
const KEEP_GOING_SUBS = new Set(['check', 'build', 'clippy', 'b']);
const TEST_SUBS = new Set(['test', 't', 'nextest']);
const posix = (p) => String(p).replace(/\\/g, '/');
const keyOf = (tree) => hashKey(['known-red', tree]);

export const knownRed = (cfg, tree) => cacheGet(cfg, NAME, keyOf(tree));

const errorsOf = (errors) => Object.fromEntries(Object.entries(errors || {}).map(([f, blocks]) => [posix(f), blocks]));
const sameErrors = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

// Add `errors` ({ file: [rustc block] }) to the state's list (and the latest one); the files now known red.
function remember(cfg, tree, head, errors) {
  const before = knownRed(cfg, tree);
  const merged = { ...(before ? before.errors || {} : {}), ...errors };
  const entry = { head, files: Object.keys(merged), errors: merged };
  cachePut(cfg, NAME, keyOf(tree), entry);
  cachePut(cfg, NAME, LATEST, entry);
  return entry.files;
}

// The files of `errs` the last list vouches for on this state: its HEAD is an ancestor, the files
// are unchanged since, and each error shows the same text.
function carried(cfg, cwd, errs, files) {
  const last = cacheGet(cfg, NAME, LATEST);
  if (!last || !last.errors || !cwd) return [];
  if (git(['merge-base', '--is-ancestor', last.head, 'HEAD'], cwd).code !== 0) return [];
  if (git(['diff', '--quiet', last.head, '--', ...files], cwd).code !== 0) return [];
  return files.filter((f) => last.errors[f] && sameErrors(last.errors[f], errs[f]));
}

// The selector naming the target a broken file belongs to, or null (a library file: every target needs it).
function selectorOf(file) {
  const test = /(?:^|\/)tests\/([^/]+?)(?:\.rs|\/main\.rs)$/.exec(file);
  if (test) return `--test ${test[1]}`;
  const bin = /(?:^|\/)src\/bin\/([^/]+?)(?:\.rs|\/main\.rs)$/.exec(file);
  return bin ? `--bin ${bin[1]}` : null;
}

export function exclude(cmd, files) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1) return null;
  const sub = toks[ci + 1];
  if (KEEP_GOING_SUBS.has(sub)) return toks.includes('--keep-going') ? null : [...toks.slice(0, ci + 2), '--keep-going', ...toks.slice(ci + 2)].join(' ');
  if (!TEST_SUBS.has(sub)) return null;
  const broken = new Set(files.map(selectorOf).filter(Boolean));
  if (!broken.size || files.some((f) => !selectorOf(f))) return null;
  const sep = toks.indexOf('--');
  const head = sep === -1 ? toks : toks.slice(0, sep);
  const out = [];
  let selectors = 0;
  let dropped = 0;
  for (let i = 0; i < head.length; i++) {
    const pair = `${head[i]} ${head[i + 1]}`;
    if ((head[i] === '--test' || head[i] === '--bin') && head[i + 1]) {
      selectors++;
      if (broken.has(pair)) dropped++;
      else out.push(head[i], head[i + 1]);
      i++;
    } else {
      if (head[i] === '--lib' || head[i] === '--tests' || head[i] === '--bins') selectors++;
      out.push(head[i]);
    }
  }
  if (!dropped) return null;
  if (dropped === selectors) return '';
  return [...out, ...(sep === -1 ? [] : toks.slice(sep))].join(' ');
}

export function foreignBuild({ cfg, cwd, entry, touched, tree, head, runBase, runAgain }) {
  const files = Object.keys(entry.errors || {}).map(posix);
  if (!files.length || files.includes(UNLOCATED)) return null;
  if (files.some((f) => touched.some((p) => f === p || f.endsWith(`/${p}`)))) return null;
  const errs = errorsOf(entry.errors);
  let known = (knownRed(cfg, tree) || { files: [] }).files;
  if (!files.every((f) => known.includes(f)) && carried(cfg, cwd, errs, files).length === files.length) {
    known = remember(cfg, tree, head, errs);
  }
  if (!files.every((f) => known.includes(f))) {
    const log = runBase(entry.cmd);
    if (!log) return null;
    const base = errorsOf(diagnose(readFileSync(log, 'utf8')).errors);
    if (!files.every((f) => base[f])) return null;
    known = remember(cfg, tree, head, base);
  }
  const note = `known red at ${String(head).slice(0, 10)}: ${files.join(', ')} fail(s) without the patch`;
  const rerun = exclude(entry.cmd, files);
  if (rerun === null) return { files, rerun: null, clean: false, note: `${note}; this command cannot leave that target out` };
  if (rerun === '') return { files, rerun: null, clean: true, note: `${note}; every target this command selects is known red` };
  const again = runAgain(rerun);
  const left = Object.keys(again.errors || {}).map(posix).filter((f) => !known.includes(f));
  const clean = again.exit === 0 || (!left.length && !(again.failedTests || []).length && Object.keys(again.errors || {}).length > 0);
  return { files, rerun, rerunExit: again.exit, rerunLog: again.log, clean, note: `${note}; re-ran without it: ${clean ? 'green' : 'still red'}` };
}
