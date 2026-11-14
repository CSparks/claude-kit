// crate-checks.mjs — what each writer's cargo check/build/clippy said about the crates it edits (KIT-T1211). Several writers
// share one checkout; a shared crate left not compiling between tool rounds blocks every other writer and the maintainer's
// demo. Two uses: a failed check names the live writer whose uncommitted edit holds the failing file, and a subagent that ends
// with an edited crate its own last check did not cover, or covered and failed, is told once.
//
//   crateCheckArgs(command)                    -> ['check', '-p', 'x'] for a `cargo check|build|clippy` line, or null
//   outcomeOf(output)                          -> { failed }  from cargo's text: an `error` line, `could not compile`
//   errorFiles(output, cwd)                    -> absolute paths of the files named by `--> path:line:col` lines
//   recordCheck(root, { writer, ok, scope, ts }) / readChecks(root)   the append-only record of finished checks
//   culprits({ files, writer, claimants })     -> [{ file, claimant }] other live writers claiming a failing file
//   unverifiedCrates({ trees, writer, checks }) -> [{ crate, failed }] crates the writer edited after, or that failed in, its last
//     covering check; a check covers a crate when the crate directory is inside its recorded scope
//   nudgeText(unverified)                      -> the stop message naming each crate

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { appendTurnRecord, readTurnRecords } from './turn-state.mjs';
import { segments } from './shell-segments.mjs';
import { inScope } from '../../scripts/broker/cargo-scope-dirs.mjs';
import { writerId } from './tool-writes.mjs';

const SLOT = 'cratechecks';
const CHECK_VERB = /^(?:check|c|clippy|build|b)$/;
const FAILED = /\berror(?:\[E\d+\])?:|could not compile|aborting due to/;
const ERROR_SITE = /-->\s+(\S+?):\d+:\d+/g;
const RECORDS_MAX = 400;
const LEADING = /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/;

export function crateCheckArgs(command) {
  for (const { text } of segments(String(command || ''), { shell: '' })) {
    const words = text.trim().replace(LEADING, '').split(/\s+/);
    const cargo = /(?:^|[\\/])cargo(?:\.exe)?$/i.test(words[0] || '');
    const verb = words.slice(1).find((w) => !w.startsWith('+'));
    if (cargo && CHECK_VERB.test(verb || '')) return words.slice(words.indexOf(verb));
  }
  return null;
}

export const outcomeOf = (output) => ({ failed: FAILED.test(String(output || '')) });

export function errorFiles(output, cwd) {
  const found = new Set();
  for (const [, rel] of String(output || '').matchAll(ERROR_SITE)) {
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
    .filter((c) => writerId(c.session, c.agent) !== writer && relOf(c.tree, file) in (c.claims || {}))
    .map((claimant) => ({ file, claimant })));
}

function crateDirOf(file) {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'Cargo.toml'))) return dir;
    if (dirname(dir) === dir) return '';
  }
}

export function unverifiedCrates({ trees, writer, checks }) {
  const lastEdit = new Map();
  for (const tree of trees) {
    for (const e of readTurnRecords(tree, 'toolwrites')) {
      if (e.w !== writer || !/\.rs$/i.test(e.p || '')) continue;
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
