// pin-scope.mjs — scope an auto-pin's consumer run to the pin delta (KIT-T618). An auto-pin job moves
// the consumer's gitlink and would run the consumer's full verify. When every file the pin moves lies
// in a crate that is not a package in the consumer's Cargo.lock (or in docs and ticket files no build
// reads), the consumer's build cannot change: the job runs only the build check (its test commands
// with `--no-run`) and the landing commit says so. A file outside every crate, a root manifest or lock,
// a changed crate that IS in the lock, or a missing lock keeps the full verify.
//
//   scopePin(cwd, commands, pins) -> { commands, note } | null     (pins: explicit pin sessions of the job)
//   changedCrates(subCwd, refs, files) -> { crates: Set, unmapped: [path] }
//   buildOnly(commands) -> the build-check form of the verify commands, [] when none builds

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function lockPackages(cwd) {
  const file = join(cwd, 'Cargo.lock');
  if (!existsSync(file)) return null;
  return new Set([...readFileSync(file, 'utf8').matchAll(/^name = "([^"]+)"/gm)].map((m) => m[1]));
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

export function scopePin(cwd, commands, pins) {
  const lock = lockPackages(cwd);
  const build = buildOnly(commands);
  if (!lock || !pins.length || !build.length) return null;
  const moved = new Set();
  for (const pin of pins) {
    const delta = deltaOf(cwd, pin);
    if (!delta) return null;
    const { crates, unmapped } = changedCrates(pin.cwd, [pin.sha, delta.old], delta.files);
    if (unmapped.length || [...crates].some((c) => lock.has(c))) return null;
    for (const c of crates) moved.add(c);
  }
  const names = [...moved].sort();
  return { commands: build, note: `no crate in this consumer's closure changed (${names.length ? `pin delta touches ${names.join(', ')}` : 'pin delta touches no crate'}); build check only` };
}
