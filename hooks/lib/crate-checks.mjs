// crate-checks.mjs — what each writer's cargo check/build/clippy said about the crates it edits (KIT-T1211). Several writers
// share one checkout; a shared crate left not compiling between tool rounds blocks every other writer and the maintainer's
// demo. Two uses: a failed check names the live writer whose uncommitted edit holds the failing file, and a subagent that ends
// with an edited crate its own last check did not cover, or covered and failed, is told once.
//
//   crateCheckArgs(command)                    -> ['check', '-p', 'x'] for a `cargo check|build|clippy` line, or null
//   outcomeOf(output)                          -> { failed }  from cargo's text: an `error` line, `could not compile`
//   errorFiles(output, cwd)                    -> absolute paths of the files named by `--> path:line:col` lines or, in the short
//                                                 message format, `path:line:col: error` lines
//   recordCheck(root, { writer, ok, scope, ts }) / readChecks(root)   the append-only record of finished checks
//   culprits({ files, writer, claimants })     -> [{ file, claimant }] other live writers claiming a failing file
//   cargoCompile(command)                      -> { args, compileOnly } for a `cargo check|build|clippy|test` line, or null; a test run
//                                                 is a check of its packages that fails only on a compile error
//   unverifiedCrates({ trees, writer, checks, notAfter?, since? }) -> [{ crate, failed }] crates the writer edited after, or that
//     failed in, its last covering check; a check covers a crate when the crate directory is inside its recorded scope; an edit
//     newer than `notAfter` or older than `since` (ms) is not counted, nor is an edit of a file no uncommitted change holds
//     (a commit landed it)
//   crateDirOf(file)                           -> nearest directory holding a Cargo.toml, or ''
//   nudgeText(unverified)                      -> the stop message naming each crate

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { appendTurnRecord, readTurnRecords } from './turn-state.mjs';
import { gitTry } from './exec.mjs';
import { segments } from './shell-segments.mjs';
import { inScope } from '../../scripts/broker/cargo-scope-dirs.mjs';
import { sameWriterId, writerId } from './tool-writes.mjs';

const SLOT = 'cratechecks';
const CHECK_VERB = /^(?:check|c|clippy|build|b)$/;
const TEST_VERB = /^(?:test|t)$/;
const CHECK_ARG = 'check';
const NO_RUN = '--no-run';
const FAILED = /\berror(?:\[E\d+\])?:|could not compile|aborting due to/;
const COMPILE_FAILED = /\berror\[E\d+\]:|could not compile|aborting due to/;
const ERROR_SITE = /-->\s+(\S+?):\d+:\d+|^(\S+?):\d+:\d+:\s+error/gm;
const REDIRECT = /^\d*>/;
const RECORDS_MAX = 400;
const LEADING = /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/;

/** The compile a cargo line did: { args, compileOnly } for check, build, clippy (any error fails it) and test (only a compile error fails it: a failing test compiled), else null. */
export function cargoCompile(command) {
  for (const { text } of segments(String(command || ''), { shell: '' })) {
    const words = text.trim().replace(LEADING, '').split(/\s+/);
    const cargo = /(?:^|[\\/])cargo(?:\.exe)?$/i.test(words[0] || '');
    const verb = words.slice(1).find((w) => !w.startsWith('+'));
    const compileOnly = TEST_VERB.test(verb || '');
    if (!cargo || !(CHECK_VERB.test(verb || '') || compileOnly)) continue;
    const args = words.slice(words.indexOf(verb)).filter((w) => !REDIRECT.test(w));
    const cargoArgs = args.includes('--') ? args.slice(0, args.indexOf('--')) : args;
    return { args: compileOnly ? [CHECK_ARG, ...cargoArgs.slice(1).filter((w) => w !== NO_RUN)] : args, compileOnly };
  }
  return null;
}

export const crateCheckArgs = (command) => cargoCompile(command)?.args ?? null;

export const outcomeOf = (output, { compileOnly = false } = {}) => ({ failed: (compileOnly ? COMPILE_FAILED : FAILED).test(String(output || '')) });

export function errorFiles(output, cwd) {
  const found = new Set();
  for (const [, arrow, short] of String(output || '').matchAll(ERROR_SITE)) {
    const rel = arrow || short;
    for (let dir = resolve(cwd); ; dir = dirname(dir)) {
      if (existsSync(resolve(dir, rel))) { found.add(resolve(dir, rel)); break; }
      if (dirname(dir) === dir) break;
    }
  }
  return [...found];
}

export const recordCheck = (root, { writer, ok, scope, ts = Date.now() }) => appendTurnRecord(root, SLOT, { w: writer, ts, ok, scope });
export const readChecks = (root) => readTurnRecords(root, SLOT).slice(-RECORDS_MAX);

const slash = (p) => String(p).replace(/\\/g, '/').toLowerCase();

export function culprits({ files, writer, claimants, relOf }) {
  return files.flatMap((file) => claimants
    .filter((c) => !sameWriterId(writerId(c.session, c.agent), writer) && relOf(c.tree, file) in (c.claims || {}))
    .map((claimant) => ({ file, claimant })));
}

export function crateDirOf(file) {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'Cargo.toml'))) return dir;
    if (dirname(dir) === dir) return '';
  }
}

const STATUS_PATH_AT = 3;

// The files of `tree` with changes no commit holds yet (tracked changes and untracked files), as lower-case slash paths; null when git cannot say.
function uncommittedFiles(tree) {
  const status = gitTry(['-c', 'core.quotepath=off', 'status', '--porcelain', '-uall'], tree);
  if (!status.ok) return null;
  return new Set(status.out.split('\n').filter(Boolean).map((l) => slash(l.slice(STATUS_PATH_AT).split(' -> ').pop().replace(/^"|"$/g, ''))));
}

export function unverifiedCrates({ trees, writer, checks, notAfter = Infinity, since = 0 }) {
  const lastEdit = new Map();
  for (const tree of trees) {
    const dirty = uncommittedFiles(tree);
    for (const e of readTurnRecords(tree, 'toolwrites')) {
      if (e.w !== writer || !/\.rs$/i.test(e.p || '') || (e.ts || 0) > notAfter || (e.ts || 0) < since) continue;
      if (dirty && !dirty.has(slash(e.p))) continue;
      const crate = crateDirOf(join(tree, e.p));
      if (crate) lastEdit.set(crate, Math.max(lastEdit.get(crate) || 0, e.ts || 0));
    }
  }
  const mine = checks.filter((c) => c.w === writer);
  return [...lastEdit].flatMap(([crate, editedAt]) => {
    const covering = mine.filter((c) => (c.scope || []).length && inScope(join(crate, 'src', 'lib.rs'), c.scope)).sort((a, b) => b.ts - a.ts)[0];
    if (!covering || covering.ts < editedAt) return [{ crate: slash(crate), failed: false }];
    return covering.ok ? [] : [{ crate: slash(crate), failed: true }];
  });
}

export function nudgeText(unverified) {
  return [
    'You edited Rust crates whose last check you cannot vouch for, and other writers share them (KIT-T1211):',
    ...unverified.map((u) => `  ${u.crate}: ${u.failed ? 'your last cargo check of it FAILED' : 'no cargo check after your last edit of it'}`),
    'Run `cargo check -p <crate>` for each (a foreground call), fix what it reports, then finish. A crate left not compiling blocks every other writer and the maintainer\'s demo.',
  ].join('\n');
}
