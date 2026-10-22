// pin-scope.mjs — the gate of an auto-pin job (KIT-T618, KIT-D104). A pin moves the consumer's gitlink and
// used to run the consumer's whole verify. The pin delta (the files between the old and new gitlink) maps to
// crates; the consumer's Cargo.lock says which of them it builds and which of its own crates depend on them.
// The job runs the consumer's build check, plus the tests of those dependent crates, and the landing commit
// says so. A pin outside the lock, or a workspace-level file, runs the build check alone.
//
//   scopePin(cfg, cwd, commands, pins) -> { commands, note } | null     (pins: explicit pin sessions of the job)
//   changedCrates(subCwd, refs, files) -> { crates: Set, unmapped: [path] }
//   buildOnly(commands) -> the build-check form of the verify commands, [] when none builds

import { join } from 'node:path';
import { dependentsOf, readLock } from './cargo-lock.mjs';
import { git, showFile } from './git.mjs';

const TEST_SUBS = new Set(['test', 't']);
const BUILD_SUBS = new Set(['build', 'b', 'check', 'clippy']);
const IGNORED_DIR = /^(?:\.ai|\.claude|\.github|docs)\//;
const DOCS = /\.(?:md|txt)$/i;
const posix = (p) => String(p).replace(/\\/g, '/');

function packageName(text) {
  const pkg = text.split(/^\[/m).find((s) => s.startsWith('package]'));
  const m = pkg && pkg.match(/^\s*name\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

// The nearest enclosing package of `path`, read from the first ref that holds its manifest.
function crateOf(subCwd, refs, path, memo) {
  for (let d = posix(path).split('/').slice(0, -1).join('/'); ; d = d.split('/').slice(0, -1).join('/')) {
    if (!memo.has(d)) {
      const manifest = d ? `${d}/Cargo.toml` : 'Cargo.toml';
      const text = refs.map((ref) => showFile(subCwd, ref, manifest)).find((t) => t !== null);
      memo.set(d, text ? packageName(text) : null);
    }
    if (memo.get(d)) return memo.get(d);
    if (!d) return null;
  }
}

export function changedCrates(subCwd, refs, files) {
  const memo = new Map();
  const crates = new Set();
  const unmapped = [];
  for (const raw of files) {
    const path = posix(raw);
    const crate = crateOf(subCwd, refs, path, memo);
    if (crate) crates.add(crate);
    else if (!IGNORED_DIR.test(path) && !DOCS.test(path)) unmapped.push(path);
  }
  return { crates, unmapped };
}

export function buildOnly(commands) {
  const out = [];
  for (const cmd of commands) {
    const toks = String(cmd).trim().split(/\s+/);
    const ci = toks.indexOf('cargo');
    if (ci === -1) continue;
    const sub = toks[ci + 1];
    if (BUILD_SUBS.has(sub)) { out.push(toks.join(' ')); continue; }
    if (!TEST_SUBS.has(sub)) continue;
    const sep = toks.indexOf('--');
    const head = sep === -1 ? toks : toks.slice(0, sep);
    if (!head.includes('--no-run')) head.splice(ci + 2, 0, '--no-run');
    out.push([...head, ...(sep === -1 ? [] : toks.slice(sep))].join(' '));
  }
  return out;
}

function deltaOf(cwd, pin) {
  const old = git(['rev-parse', `HEAD:${pin.path}`], cwd).out;
  if (!old || old === pin.sha) return null;
  const diff = git(['diff', '--name-only', '-z', old, pin.sha], pin.cwd);
  return diff.code === 0 ? { old, files: diff.out.split(String.fromCharCode(0)).filter(Boolean) } : null;
}

// Names of every crate the submodule holds at `ref`.
function submoduleCrates(subCwd, ref) {
  const listed = git(['ls-tree', '-r', '--name-only', '-z', ref], subCwd).out.split(String.fromCharCode(0)).filter((p) => /(?:^|\/)Cargo\.toml$/.test(p));
  return new Set(listed.map((m) => showFile(subCwd, ref, m)).filter(Boolean).map(packageName).filter(Boolean));
}

const testCommand = (commands) => commands.find((c) => /cargo\s+(?:test|t)(?:\s|$)/.test(c) && !/--no-run/.test(c));

/**
 * The gate of an auto-pin job (KIT-D104, KIT-T618): the consumer's build check, plus the tests of the
 * consumer's own crates that depend on a changed crate in its Cargo.lock. Never the full verify.
 *   cfg.pinTestArgs (`pin_test_args`) is appended to the test run (a nextest profile without the GPU group).
 * A file no crate owns (a workspace manifest or lock) leaves the build check alone.
 */
export function scopePin(cfg, cwd, commands, pins) {
  const lock = readLock(join(cwd, 'Cargo.lock'));
  const build = buildOnly(commands);
  const base = testCommand(commands);
  if (!pins.length || !build.length) return null;
  const moved = new Set();
  let wide = false;
  let sub = new Set();
  for (const pin of pins) {
    const delta = deltaOf(cwd, pin);
    if (!delta) return null;
    const { crates, unmapped } = changedCrates(pin.cwd, [pin.sha, delta.old], delta.files);
    wide = wide || unmapped.length > 0;
    for (const c of crates) moved.add(c);
    sub = new Set([...sub, ...submoduleCrates(pin.cwd, pin.sha)]);
  }
  const names = [...moved].sort();
  const touched = names.length ? `pin delta touches ${names.join(', ')}` : 'pin delta touches no crate';
  const inLock = lock ? names.filter((c) => lock.has(c)) : [];
  const members = lock && base ? [...dependentsOf(lock, inLock)].filter((n) => lock.get(n)?.local && !sub.has(n)).sort() : [];
  if (wide || !lock || !members.length) {
    const why = wide ? 'a workspace-level file changed' : !lock ? 'no Cargo.lock to read'
      : inLock.length ? `no consumer crate depends on ${inLock.join(', ')} (${touched})` : `no crate in this consumer's closure changed (${touched})`;
    return { commands: build, note: `${why}; build check only` };
  }
  const args = (cfg.pinTestArgs || []).join(' ');
  const test = `${base.replace(/\s+--no-fail-fast/, '')} ${members.map((m) => `-p ${m}`).join(' ')}${args ? ` ${args}` : ''}`;
  return { commands: [...build, test], note: `${touched}; build check plus tests of ${members.join(', ')}` };
}
