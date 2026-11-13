// guard.mjs — which files move-lines may read lines from and write lines into (KIT-T1159).
//
//   moveLinesProblem({ source, dests, cwd }) -> string   '' when the move is allowed, else the first reason it is not
//     source and every dest (absolute paths): inside the git root of `cwd` by real path, a hand-authored source path
//     (isSourcePath, judged on the root-relative path), no symlink or junction on the way from the root to it, and
//     not one of the kit's own hook, config or settings files nor anything under .git.
//     source: a file git tracks, or one an Edit or Write tool left with exactly its current content (the accepted-writes
//     ledger), so only lines that already passed a gate or a commit are moved.

import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitTry } from '../../hooks/lib/exec.mjs';
import { isKitCheckout } from '../../hooks/lib/kit-checkout.mjs';
import { isSourcePath, slashed } from '../../hooks/lib/source-path.mjs';
import { hashOf, toolWriteProves } from '../../hooks/lib/tool-writes.mjs';

const PROTECTED_DIR = /^(?:\.claude|\.claude-plugin|\.githooks|\.husky|\.ai)\//i;
const KIT_HOOKS_DIR = /^hooks\//;
const INSTALL_HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks');

const realOrNull = (p) => { try { return realpathSync.native(p); } catch { return null; } };
const inside = (root, path) => { const rel = relative(root, path); return !rel.startsWith('..') && !isAbsolute(rel); };

// The real path of `path`, whether or not it exists yet: its nearest existing ancestor made real, the rest appended.
function realTarget(path) {
  const tail = [];
  let head = path;
  while (!existsSync(head) && dirname(head) !== head) { tail.unshift(basename(head)); head = dirname(head); }
  const real = realOrNull(head);
  return real === null ? null : join(real, ...tail);
}

// A symlink or junction between `path` and the repo root (the path itself and every existing ancestor).
function linkOnTheWay(path, realRoot) {
  for (let p = path, parent = dirname(p); ; p = parent, parent = dirname(p)) {
    try { if (lstatSync(p).isSymbolicLink()) return p; } catch { /* not yet created */ }
    if (realOrNull(p) === realRoot || parent === p) return '';
  }
}

function protectedProblem(rel, realRoot, real) {
  const hooksOfKit = isKitCheckout(realRoot) && KIT_HOOKS_DIR.test(rel);
  const installHooks = realOrNull(INSTALL_HOOKS);
  if (PROTECTED_DIR.test(rel) || hooksOfKit || (installHooks !== null && inside(installHooks, real))) return 'a hook, config or settings file of the kit or the project';
  return '';
}

function writableProblem(path, realRoot) {
  const real = realTarget(path);
  if (real === null || !inside(realRoot, real)) return `${path} is outside the git root ${realRoot}`;
  const rel = slashed(relative(realRoot, real));
  if (!isSourcePath(rel)) return `${path} is not a hand-authored source path (a source extension outside build output, .git and temp)`;
  const link = linkOnTheWay(path, realRoot);
  if (link) return `${link} is a symlink: name the real file`;
  const protectedReason = protectedProblem(rel, realRoot, real);
  return protectedReason ? `${path} is ${protectedReason}: change it with Edit or Write` : '';
}

function sourceProblem(source, realRoot) {
  const real = realOrNull(source);
  if (real === null) return `${source} does not exist`;
  const rel = slashed(relative(realRoot, real));
  if (gitTry(['ls-files', '--error-unmatch', '--', rel], realRoot).ok) return '';
  return toolWriteProves(realRoot, rel, 0, hashOf(readFileSync(real)))
    ? '' : `${source} is neither tracked by git nor a file an Edit or Write tool left as it is: commit it, or save it with Write first`;
}

export function moveLinesProblem({ source, dests, cwd = process.cwd() }) {
  const top = gitTry(['rev-parse', '--show-toplevel'], cwd);
  const realRoot = top.ok ? realOrNull(top.out.trim()) : null;
  if (realRoot === null) return `${cwd} is not inside a git repository`;
  for (const path of [source, ...dests]) {
    const problem = writableProblem(path, realRoot);
    if (problem) return problem;
  }
  return sourceProblem(source, realRoot);
}
