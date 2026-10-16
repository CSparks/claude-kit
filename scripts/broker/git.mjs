// git.mjs — the broker's git primitives, run against a named checkout (the build checkout or a
// submodule path). Dependency-free: every call is `spawnSync('git', args, { cwd })`.
//
// Every landing is a commit by explicit paths on main (land.mjs); there are no lane branches or
// worktrees to manage.

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchesAny } from './glob.mjs';
import { runPulsing } from './run-pulsing.mjs';
import { pulseActive } from './stall.mjs';

// Run a git subcommand; returns { code, out, err }. Never throws.
export function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return { code: r.status == null ? 1 : r.status, out: (r.stdout || '').trim(), err: (r.stdout || '') + (r.stderr || '') };
}

// A git call that can run repo hooks for minutes (commit, push): inside the daemon it keeps the
// heartbeat fresh (run-pulsing.mjs, KIT-T493); `env` replaces the environment when given.
export function gitLong(args, cwd, env) {
  if (!pulseActive()) {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, ...(env ? { env } : {}) });
    return { code: r.status == null ? 1 : r.status, out: (r.stdout || '').trim(), err: (r.stdout || '') + (r.stderr || '') };
  }
  const logPath = join(tmpdir(), `broker-git-${process.pid}-${Date.now()}.log`);
  try {
    const r = runPulsing(['git', ...args], { cwd, env: env || process.env, logPath });
    return { code: r.status, out: r.out.trim(), err: r.out };
  } finally { rmSync(logPath, { force: true }); }
}

// Working-tree state a hand-driven writer can collide with. A modified tracked file counts when
// `dirtyBlocks` is null (every one), or when it matches `dirtyBlocks` or is in `touched` (the
// paths the job's patch writes). Untracked files count only when they match `untrackedBlocks`
// (cargo auto-discovers new *.rs and Cargo.toml). Everything else never pauses the broker.
export function checkoutState(cwd, { untrackedBlocks = [], dirtyBlocks = null, touched = [] } = {}) {
  const tracked = trackedModifications(cwd);
  const entries = tracked.records
    .filter(({ path }) => dirtyBlocks === null || matchesAny(dirtyBlocks, path) || touched.includes(path))
    .map(({ xy, path }) => `${xy.trim()} ${path}`);
  const other = git(['ls-files', '--others', '--exclude-standard', '-z'], cwd);
  if (other.code === 0 && untrackedBlocks.length) {
    for (const p of other.out.split(String.fromCharCode(0)).filter(Boolean)) if (matchesAny(untrackedBlocks, p)) entries.push(`?? ${p}`);
  }
  return { clean: tracked.code === 0 && entries.length === 0, entries };
}

// Every modified tracked file as { xy, path }, plus git's exit code.
export function trackedModifications(cwd) {
  const tracked = git(['status', '--porcelain', '-z', '--untracked-files=no'], cwd);
  const records = [];
  const parts = tracked.err ? tracked.err.split(String.fromCharCode(0)) : [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    if (/[RC]/.test(xy)) i++; // a rename/copy record is followed by its source path
    records.push({ xy, path: rec.slice(3) });
  }
  return { code: tracked.code, records };
}

/** Paths of every modified tracked file. */
export const dirtyPaths = (cwd) => trackedModifications(cwd).records.map((r) => r.path);

// Every Cargo.lock in the repo, tracked or not: cargo rewrites them as a side effect of a build.
export function lockFiles(cwd) {
  const r = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'Cargo.lock', '**/Cargo.lock'], cwd);
  return r.code === 0 ? r.out.split(String.fromCharCode(0)).filter(Boolean) : [];
}

// The lock files that differ from HEAD: modified when tracked, present when new.
export const changedLocks = (cwd) => lockFiles(cwd).filter((p) => git(['status', '--porcelain', '--', p], cwd).out !== '');

export function revParse(cwd, ref) {
  const r = git(['rev-parse', ref], cwd);
  return r.code === 0 ? r.out : '';
}

// `env` (prepush.mjs buildEnv) reaches the repo's pre-push hook, so a gate it runs builds in the shared cache.
// It pushes HEAD (never the local branch, which a detached HEAD leaves behind) and confirms the
// remote's branch now holds HEAD's sha (KIT-T520).
export function push(cwd, remote, branch, env) {
  const r = gitLong(['push', remote, `HEAD:refs/heads/${branch}`], cwd, env);
  if (r.code !== 0) return { ok: false, err: r.err };
  const head = revParse(cwd, 'HEAD');
  const remoteSha = git(['ls-remote', remote, `refs/heads/${branch}`], cwd).out.split(/\s+/)[0];
  return remoteSha === head ? { ok: true, err: r.err } : { ok: false, err: `push said ok but ${remote}/${branch} is ${remoteSha || 'missing'}, not ${head}` };
}

// Put `branch` on HEAD so a landing commits on it: already on it is a no-op; a detached HEAD
// that descends from the branch moves the branch up to HEAD; anything else is refused (KIT-T520).
export function attachBranch(cwd, branch) {
  const on = git(['symbolic-ref', '-q', '--short', 'HEAD'], cwd);
  if (on.code === 0 && on.out === branch) return { ok: true };
  if (on.code === 0) return { ok: false, error: `checkout is on branch ${on.out}, not ${branch}` };
  if (git(['merge-base', '--is-ancestor', branch, 'HEAD'], cwd).code !== 0) return { ok: false, error: `HEAD is detached and does not descend from ${branch}; settle it by hand` };
  const moved = git(['checkout', '-q', '-B', branch, 'HEAD'], cwd);
  return moved.code === 0 ? { ok: true, reattached: true } : { ok: false, error: `could not reattach ${branch}: ${moved.err.trim().slice(0, 200)}` };
}

// The staged pathspecs — used by the submodule re-pin to assert nothing but the pointer is staged.
export function stagedPaths(cwd) {
  const r = git(['diff', '--cached', '--name-only'], cwd);
  return r.code === 0 && r.out ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

// A tracked file's text at `ref` (untrimmed), or null when absent there or not a file (a directory).
export function showFile(cwd, ref, path) {
  const r = spawnSync('git', ['cat-file', 'blob', `${ref}:${path}`], { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28 });
  return r.status === 0 ? r.stdout : null;
}

// The tracked file paths at `ref` under `path`: [path] for a file, its files for a directory, [] when absent.
export function treeFiles(cwd, ref, path) {
  const r = git(['ls-tree', '-r', '-z', '--name-only', ref, '--', path], cwd);
  return r.code === 0 ? r.out.split(String.fromCharCode(0)).filter(Boolean) : [];
}

// Store a working file's exact bytes (no clean/smudge filters) in the object database.
export function hashObject(cwd, path) {
  const r = git(['hash-object', '-w', '--no-filters', '--', path], cwd);
  return r.code === 0 ? r.out : null;
}

// Put `bytes` back at `path` the way a checkout writes it: when they are the tracked file's content
// (the clean filter maps them to the index blob) `git checkout-index` writes the working form
// (CRLF under autocrlf) and records its stat, so the file reads as unmodified; any other content,
// or an untracked path, is written exactly as found.
export function writeAsCheckout(cwd, path, bytes, write) {
  const staged = git(['ls-files', '-s', '--', path], cwd).out.match(/^\d+ ([0-9a-f]+) 0\t/);
  if (staged) {
    const clean = spawnSync('git', ['hash-object', '--stdin', '--path', path], { cwd, input: bytes, windowsHide: true, encoding: 'utf8' });
    if (clean.status === 0 && clean.stdout.trim() === staged[1] && git(['checkout-index', '-f', '-u', '-q', '--', path], cwd).code === 0) return;
  }
  write(bytes);
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
