// manifest-config.mjs — a cargo command whose --manifest-path reaches into a workspace with its own .cargo/ directory.
// Cargo loads .cargo/config.toml from the working directory and its parents, never from the manifest's folder, so such a
// command runs without that workspace's linker, jobs and flags; the changed config value then marks every crate dirty
// each time the command is run from the other directory.
//
//   unloadedConfigs(tokens, cwd, cargoHome) -> the .cargo directories the manifest path sits under that cargo will not load from cwd
//   commandConfigWarnings(command, cwd, cargoHome?) -> one warning line per such directory, for each cargo segment of a command string
//                                                       (`&&`, `;`, `|` split segments; a leading `cd <dir>` moves the working directory)
//   shimConfigWarnings(args, cwd)          -> the same for the argument list a cargo shim received

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

const CONFIG_FILES = ['config.toml', 'config'];
const ARGS_END = '--';
const SEGMENT_SPLIT = /&&|\|\||[;|]/;
const CD = /^cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))/;
const CARGO = /^cargo(?:\.exe)?$/;

const sameOrAbove = (dir, cwd) => {
  const a = resolve(dir).toLowerCase();
  const b = resolve(cwd).toLowerCase();
  return b === a || b.startsWith(a.endsWith(sep) ? a : a + sep);
};

function manifestPath(tokens) {
  const end = tokens.indexOf(ARGS_END);
  const own = end === -1 ? tokens : tokens.slice(0, end);
  for (let i = 0; i < own.length; i++) {
    if (own[i] === '--manifest-path') return own[i + 1] || null;
    if (own[i].startsWith('--manifest-path=')) return own[i].slice('--manifest-path='.length);
  }
  return null;
}

const hasConfig = (dir) => CONFIG_FILES.some((f) => existsSync(join(dir, '.cargo', f)));

export function unloadedConfigs(tokens, cwd, cargoHome = process.env.CARGO_HOME || join(homedir(), '.cargo')) {
  const manifest = manifestPath(tokens);
  if (!manifest) return [];
  const found = [];
  let dir = dirname(resolve(cwd, manifest));
  for (;;) {
    const cargoDir = join(dir, '.cargo');
    if (hasConfig(dir) && resolve(cargoDir).toLowerCase() !== resolve(cargoHome).toLowerCase() && !sameOrAbove(dir, cwd)) found.push(cargoDir);
    const parent = dirname(dir);
    if (parent === dir) return found;
    dir = parent;
  }
}

const warningLine = (cargoDir, cwd) => {
  const workspace = dirname(cargoDir);
  return `[build-budget] --manifest-path reaches into ${workspace}, whose ${cargoDir} cargo will not load from ${cwd} (it reads .cargo from the working directory and its parents): the run loses that config's linker and jobs, and its changed config value marks every crate dirty each time the command switches between the two directories. Run it from that workspace: cd ${workspace} && cargo ...`;
};

export function commandConfigWarnings(command, cwd, cargoHome) {
  const warnings = [];
  let here = cwd;
  for (const segment of String(command).split(SEGMENT_SPLIT)) {
    const text = segment.trim();
    const cd = CD.exec(text);
    if (cd) { here = resolve(here, cd[1] || cd[2] || cd[3]); continue; }
    const tokens = text.split(/\s+/).map((t) => t.replace(/^["']|["']$/g, ''));
    if (!CARGO.test(tokens[0] || '')) continue;
    for (const cargoDir of unloadedConfigs(tokens.slice(1), here, cargoHome)) warnings.push(warningLine(cargoDir, here));
  }
  return warnings;
}

export const shimConfigWarnings = (args, cwd) => unloadedConfigs(args, cwd).map((cargoDir) => warningLine(cargoDir, cwd));
