// framework-pin-fixture.mjs — throwaway git fixtures for the framework pin report: an upstream repo, and consumer
// superprojects that carry it as the real submodule `rapid-game` (added the way hooks/commit-gate.test.mjs does).

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const dirs = [];
export const SUB = 'rapid-game';

export const git = (cwd, ...args) => execFileSync('git', ['-c', 'protocol.file.allow=always', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

export const tmp = (prefix) => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
};

export const cleanup = () => dirs.forEach((d) => rmSync(d, { recursive: true, force: true, maxRetries: 3 }));

export function write(cwd, file, text) {
  mkdirSync(dirname(join(cwd, file)), { recursive: true });
  writeFileSync(join(cwd, file), text);
}

export function identify(dir) {
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  return dir;
}

/** Commit `files` ({ path: text }) in `cwd`; returns the new sha. */
export function commit(cwd, message, files) {
  for (const [path, text] of Object.entries(files)) write(cwd, path, text);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD').trim();
}

const CORE_MANIFEST = '[package]\nname = "rg-core"\nversion = "0.1.0"\n';
const LOCK = `version = 3\n\n[[package]]\nname = "game"\nversion = "0.1.0"\ndependencies = [\n "rg-core",\n]\n\n[[package]]\nname = "rg-core"\nversion = "0.1.0"\n`;

export function upstream() {
  const dir = identify((() => { const d = tmp('kit-pin-up-'); git(d, 'init', '-q', '-b', 'main'); return d; })());
  commit(dir, 'init', { 'a.txt': 'a\n', 'crates/core/Cargo.toml': CORE_MANIFEST, 'crates/core/src/lib.rs': '// core\n' });
  return dir;
}

/** A consumer superproject whose submodule `rapid-game` is cloned from `up` and pinned at its current main. */
export function consumer(up, { name = 'game' } = {}) {
  const root = identify((() => { const d = tmp(`kit-pin-${name}-`); git(d, 'init', '-q', '-b', 'main'); return d; })());
  write(root, 'Cargo.lock', LOCK);
  git(root, 'submodule', 'add', '-q', up, SUB);
  identify(join(root, SUB));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return { root, sub: join(root, SUB) };
}

/** Everything the report must leave alone, as one comparable string. */
export function snapshot({ root, sub }) {
  return [root, sub].map((d) => [
    git(d, 'status', '--porcelain=v2', '--untracked-files=all'),
    git(d, 'rev-parse', 'HEAD'),
    git(d, 'stash', 'list'),
    git(d, 'for-each-ref', 'refs/heads', 'refs/tags'),
  ].join('\n--\n')).join('\n====\n');
}
