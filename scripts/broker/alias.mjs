// alias.mjs — keep a `-p <crate>` check on its crate (KIT-T516, KIT-T527). A project alias can carry
// `--workspace` (stiletto: `t = "nextest run --workspace ..."`) and cargo lets it override `-p`.
// `packageScoped(cmd, cwd)` expands such an alias without the flag when the command names a package.
// `readAliases(cwd)` → { name: [tokens] } from `<cwd>/.cargo/config.toml`.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKSPACE_FLAGS = new Set(['--workspace', '--all']);
const PACKAGE_FLAGS = new Set(['-p', '--package']);
const FEATURE_FLAGS = new Set(['--features', '-F']);

// A feature alias keeps `--workspace` so the build's feature set (and its artifacts) stay the
// alias's; `-p` becomes a nextest filterset, since cargo refuses `--features f` on a package without f (KIT-T527).
function filtered(toks, ci, alias, rest) {
  const pkgs = [];
  const kept = [];
  for (let i = 0; i < rest.length; i++) {
    if (PACKAGE_FLAGS.has(rest[i]) && rest[i + 1] !== undefined) pkgs.push(rest[++i]);
    else kept.push(rest[i]);
  }
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

export function packageScoped(cmd, cwd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1 || !cwd) return String(cmd).trim();
  const rest = toks.slice(ci + 2);
  const sep = rest.indexOf('--');
  const cargoArgs = sep === -1 ? rest : rest.slice(0, sep);
  if (!cargoArgs.some((t) => PACKAGE_FLAGS.has(t))) return String(cmd).trim();
  const alias = readAliases(cwd)[toks[ci + 1]];
  if (!alias || !alias.some((t) => WORKSPACE_FLAGS.has(t))) return String(cmd).trim();
  if (alias[0] === 'nextest' && alias.some((t) => FEATURE_FLAGS.has(t))) return filtered(toks, ci, alias, rest);
  return [...toks.slice(0, ci + 1), ...alias.filter((t) => !WORKSPACE_FLAGS.has(t)), ...rest].join(' ');
}
