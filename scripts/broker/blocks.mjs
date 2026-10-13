// blocks.mjs — the untracked-path block set derived from a checkout's cargo layout (KIT-T293).
// An untracked file pauses the queue only where cargo would pick it up: inside a crate whose
// manifest is tracked, or under a tracked workspace's `members` globs. An untracked standalone
// crate outside the workspace never builds into a job, so it never blocks.
//
//   derivedUntrackedBlocks(cwd) -> string[] globs, or null when the checkout has no tracked
//   Cargo.toml (the caller keeps its default).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { git } from './git.mjs';

const ROOT_TARGET_DIRS = ['src', 'tests', 'examples', 'benches'];

// Quoted strings of `members = [ ... ]` inside the manifest's [workspace] table.
function workspaceMembers(text) {
  const lines = text.split('\n').map((l) => l.replace(/#.*$/, ''));
  const start = lines.findIndex((l) => /^\s*\[workspace\]\s*$/.test(l));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
  const table = lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
  const list = /^\s*members\s*=\s*\[([^\]]*)\]/m.exec(table);
  return list ? [...list[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map((m) => m[1] || m[2]) : [];
}

const underDir = (dir, tail) => (dir === '.' ? tail : `${dir}/${tail}`);

// A crate directory's blocks: its manifest and every source file below it. The root package
// owns only cargo's conventional target directories, so nested non-members beside it stay free.
function crateBlocks(dir) {
  if (dir !== '.') return [underDir(dir, 'Cargo.toml'), underDir(dir, '**/*.rs')];
  return ['Cargo.toml', 'build.rs', ...ROOT_TARGET_DIRS.map((d) => `${d}/**/*.rs`)];
}

/** Globs of the paths cargo would build from `cwd`, or null without a tracked Cargo.toml. */
export function derivedUntrackedBlocks(cwd) {
  const listed = git(['ls-files', '-z', '--', 'Cargo.toml', '**/Cargo.toml'], cwd);
  if (listed.code !== 0) return null;
  const manifests = listed.out.split('\0').filter(Boolean);
  if (!manifests.length) return null;
  const blocks = new Set();
  for (const manifest of manifests) {
    const dir = dirname(manifest).replace(/\\/g, '/');
    for (const b of crateBlocks(dir)) blocks.add(b);
    let text = '';
    try { text = readFileSync(join(cwd, manifest), 'utf8'); } catch { continue; }
    for (const m of workspaceMembers(text)) for (const b of crateBlocks(underDir(dir, m).replace(/^\.\//, ''))) blocks.add(b);
  }
  return [...blocks];
}
