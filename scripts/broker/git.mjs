// git.mjs — the broker's git primitives, run against a named checkout (the build checkout or a
// submodule path). Dependency-free: every call is `spawnSync('git', args, { cwd })`.
//
// Every landing is a commit by explicit paths on main (land.mjs); there are no lane branches or
// worktrees to manage.

import { spawnSync } from 'node:child_process';
import { matchesAny } from './glob.mjs';

// Run a git subcommand; returns { code, out, err }. Never throws.
export function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return { code: r.status == null ? 1 : r.status, out: (r.stdout || '').trim(), err: (r.stdout || '') + (r.stderr || '') };
}

// Working-tree state a hand-driven writer can collide with: modified tracked files, plus
// untracked files matching `untrackedBlocks` (cargo auto-discovers new *.rs and Cargo.toml).
// Other untracked files (assets, images) never pause the broker.
export function checkoutState(cwd, { untrackedBlocks = [] } = {}) {
  const tracked = git(['status', '--porcelain', '--untracked-files=no'], cwd);
  const entries = tracked.out ? tracked.out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  const other = git(['ls-files', '--others', '--exclude-standard', '-z'], cwd);
  if (other.code === 0 && untrackedBlocks.length) {
    for (const p of other.out.split(String.fromCharCode(0)).filter(Boolean)) if (matchesAny(untrackedBlocks, p)) entries.push(`?? ${p}`);
  }
  return { clean: tracked.code === 0 && entries.length === 0, entries };
}

export function revParse(cwd, ref) {
  const r = git(['rev-parse', ref], cwd);
  return r.code === 0 ? r.out : '';
}

export function push(cwd, remote, branch) {
  const r = git(['push', remote, branch], cwd);
  return { ok: r.code === 0, err: r.err };
}

// The staged pathspecs — used by the submodule re-pin to assert nothing but the pointer is staged.
export function stagedPaths(cwd) {
  const r = git(['diff', '--cached', '--name-only'], cwd);
  return r.code === 0 && r.out ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

// A tracked file's text at `ref` (untrimmed), or null when absent there.
export function showFile(cwd, ref, path) {
  const r = spawnSync('git', ['show', `${ref}:${path}`], { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28 });
  return r.status === 0 ? r.stdout : null;
}

// Store a working file's exact bytes (no clean/smudge filters) in the object database.
export function hashObject(cwd, path) {
  const r = git(['hash-object', '-w', '--no-filters', '--', path], cwd);
  return r.code === 0 ? r.out : null;
}

// A blob's exact bytes.
export function catBlob(cwd, sha) {
  const r = spawnSync('git', ['cat-file', 'blob', sha], { cwd, windowsHide: true, maxBuffer: 1 << 28 });
  return r.status === 0 ? r.stdout : null;
}

// Commits on main since `base` that touched `path`: one `<sha> <subject>` line each.
export function logSince(cwd, base, path) {
  const r = git(['log', '--oneline', `${base}..HEAD`, '--', path], cwd);
  return r.code === 0 && r.out ? r.out.split('\n') : [];
}
