// Locating the thing a path belongs to: the code project (projectRoot), the .ai
// STORE that owns it (storeRoot), the central data repo behind a junctioned .ai
// (centralDataRoot), plus the path classifiers every quality gate shares.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { git } from './exec.mjs';

export function gitRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd).trim();
}

// A repo has adopted the workflow iff it has .ai/ (or a legacy root ROADMAP.md).
// Every hook no-ops on unadopted repos, so the global install never interferes.
export function adopted(root) {
  return !!root && (existsSync(join(root, '.ai')) || existsSync(join(root, 'ROADMAP.md')));
}

// A project's canonical name: the .claude-project pointer (centralized projects) else the
// repo's directory name (local projects).
export function projectName(root) {
  try {
    const m = readFileSync(join(root, '.claude-project'), 'utf8').match(/^project:[ \t]*(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* no pointer — a local project; fall back to the dir name */
  }
  return basename(root);
}

// The central data repo holding this project's .ai (the junction/symlink target), or
// null when .ai lives in-repo (local mode) / doesn't exist.
export function centralDataRoot(projRoot) {
  try {
    const ai = join(projRoot, '.ai');
    if (!existsSync(ai)) return null;
    const top = git(['-C', realpathSync(ai), 'rev-parse', '--show-toplevel']).trim();
    if (top && realpathSync(top) !== realpathSync(projRoot)) return top;
  } catch {
    /* not a junction / not a repo */
  }
  return null;
}

// Nearest ancestor whose <dir>/.ai/config.yml exists — the project whose STORE a file
// belongs to (cap/ingest semantics; distinct from projectRoot's code-project markers).
export function storeRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.ai', 'config.yml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const ROOT_MARKERS = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'CMakeLists.txt', '.git'];

// Nearest ancestor holding a project marker; falls back to the start dir.
export function projectRoot(startDir) {
  let dir = startDir;
  for (;;) {
    if (ROOT_MARKERS.some((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

// Generated/dependency trees no quality check should touch.
export const VENDORED = /\/(node_modules|vendor|\.venv|venv|dist|build|target|\.git)\//;

// Lockfiles / dependency manifests no content check should touch (KIT-T059 — was
// duplicated verbatim in pre-write and lint).
export const LOCKFILES = /(\.lock|\.sum)$|(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|uv\.lock)$/;

// Lowercased extension of a path's basename, '' when none.
export function fileExt(p) {
  const b = basename(String(p).replace(/\\/g, '/'));
  return b.includes('.') ? b.split('.').pop().toLowerCase() : '';
}
