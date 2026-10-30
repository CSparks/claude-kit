// alias.mjs — keep a `-p <crate>` check on its crate (KIT-T516, KIT-T527). A project alias can carry
// `--workspace` (stiletto: `t = "nextest run --workspace ..."`) and cargo lets it override `-p`.
// `packageScoped(cmd, cwd)` expands such an alias without the flag when the command names a package.
// `readAliases(cwd)` → { name: [tokens] } from `<cwd>/.cargo/config.toml`.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { dependenciesOf, readLock } from './cargo-lock.mjs';

const WORKSPACE_FLAGS = new Set(['--workspace', '--all']);
const PACKAGE_FLAGS = new Set(['-p', '--package']);
const FEATURE_FLAGS = new Set(['--features', '-F']);

// The alias's `--features` values as package names when every one is `pkg/feature`, else null.
function featurePackages(alias) {
  const values = alias.flatMap((t, i) => (FEATURE_FLAGS.has(alias[i - 1]) ? t.split(',') : []));
  const names = values.map((v) => /^([^/?]+)\??\//.exec(v)?.[1]);
  return values.length && names.every(Boolean) ? names : null;
}

// True when no crate named by `-p` depends, through the workspace's Cargo.lock, on a package the alias's features name: the
// features cannot change those crates' builds, so they build alone instead of with the whole workspace behind them (KIT-T729).
function featuresMissCrates(dir, alias, pkgs) {
  const featured = featurePackages(alias);
  if (!featured) return false;
  let lock = null;
  for (let d = dir; !lock; d = dirname(d)) {
    lock = readLock(join(d, 'Cargo.lock'));
    if (dirname(d) === d) break;
  }
  if (!lock || !pkgs.every((p) => lock.has(p))) return false;
  const closure = dependenciesOf(lock, pkgs);
  return featured.every((p) => !closure.has(p));
}

const withoutFeatures = (alias) => alias.filter((t, i) => !FEATURE_FLAGS.has(t) && !FEATURE_FLAGS.has(alias[i - 1]) && !WORKSPACE_FLAGS.has(t));

// A feature alias keeps `--workspace` so the build's feature set (and its artifacts) stay the
// alias's; `-p` becomes a nextest filterset, since cargo refuses `--features f` on a package without f (KIT-T527).
function filtered(toks, ci, alias, rest, dir) {
  const pkgs = [];
  const kept = [];
  for (let i = 0; i < rest.length; i++) {
    if (PACKAGE_FLAGS.has(rest[i]) && rest[i + 1] !== undefined) pkgs.push(rest[++i]);
    else kept.push(rest[i]);
  }
  if (featuresMissCrates(dir, alias, pkgs)) return [...toks.slice(0, ci + 1), ...withoutFeatures(alias), ...rest].join(' ');
  const sep = kept.indexOf('--');
  const head = sep === -1 ? kept : kept.slice(0, sep);
  const tail = sep === -1 ? [] : kept.slice(sep);
  const filter = ['-E', `"${pkgs.map((p) => `package(${p})`).join('|')}"`];
  return [...toks.slice(0, ci + 1), ...alias, ...head, ...filter, ...tail].join(' ');
}

const tokens = (text) => String(text).match(/"[^"]*"|\S+/g)?.map((t) => t.replace(/^"|"$/g, '')) || [];

export function readAliases(cwd) {
  for (const name of ['config.toml', 'config']) {
    const file = join(cwd, '.cargo', name);
    if (!existsSync(file)) continue;
    const out = {};
    let inAlias = false;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const section = /^\s*\[([^\]]+)\]/.exec(line);
      if (section) { inAlias = section[1].trim() === 'alias'; continue; }
      const kv = inAlias && /^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/.exec(line);
      if (!kv) continue;
      const value = kv[2];
      if (value.startsWith('"')) out[kv[1]] = tokens(value.slice(1, value.lastIndexOf('"')));
      else if (value.startsWith('[')) out[kv[1]] = [...value.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    }
    return out;
  }
  return {};
}

// The directory cargo runs in: `cwd` after every `cd <dir>` ahead of the cargo token.
function cargoDir(toks, ci, cwd) {
  let dir = cwd;
  for (let i = 0; i < ci; i++) if (toks[i] === 'cd' && toks[i + 1]) dir = resolve(dir, toks[i + 1].replace(/^["']|["']$/g, ''));
  return dir;
}

// Cargo merges `.cargo/config.toml` from the working directory up; the nearest alias wins.
function aliasesAt(dir) {
  const found = {};
  for (let d = dir; ; d = dirname(d)) {
    for (const [name, value] of Object.entries(readAliases(d))) if (!(name in found)) found[name] = value;
    if (dirname(d) === d) return found;
  }
}

export function packageScoped(cmd, cwd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1 || !cwd) return String(cmd).trim();
  const rest = toks.slice(ci + 2);
  const sep = rest.indexOf('--');
  const cargoArgs = sep === -1 ? rest : rest.slice(0, sep);
  if (!cargoArgs.some((t) => PACKAGE_FLAGS.has(t))) return String(cmd).trim();
  const alias = aliasesAt(cargoDir(toks, ci, cwd))[toks[ci + 1]];
  if (!alias || !alias.some((t) => WORKSPACE_FLAGS.has(t))) return String(cmd).trim();
  if (alias[0] === 'nextest' && alias.some((t) => FEATURE_FLAGS.has(t))) return filtered(toks, ci, alias, rest, cargoDir(toks, ci, cwd));
  return [...toks.slice(0, ci + 1), ...alias.filter((t) => !WORKSPACE_FLAGS.has(t)), ...rest].join(' ');
}

/** The tokens `cargo <sub>` expands to in the checkout `cmd` runs in (a leading `cd <dir> &&` counts), or null when `<sub>` is no alias. */
export function aliasOf(cmd, cwd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1 || !cwd) return null;
  return aliasesAt(cargoDir(toks, ci, cwd))[toks[ci + 1]] || null;
}

/** True when `cmd` is a cargo-nextest run: `cargo nextest …`, or an alias of the checkout that expands to `nextest` (stiletto's `cargo t`). */
export function runsNextest(cmd, cwd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1) return false;
  if (toks[ci + 1] === 'nextest') return true;
  const alias = aliasOf(cmd, cwd);
  return !!alias && alias[0] === 'nextest';
}
