#!/usr/bin/env node
// runtime-publish.mjs — seal the COMMITTED kit tree into a runtime directory sessions run from
// (KIT-T450). Writers edit the repo; every other session loads scripts and hooks from
// `<runtime>/current`, so a half-edited file is never loaded.
//
//   npm run publish:runtime        # npm test first, then publish: the ONLY way `current` moves
//   node scripts/runtime-publish.mjs [--runtime <dir>] [--keep N]   # refuses outside that npm script
//
// Layout: <runtime>/<sha>/ (immutable `git archive HEAD`), <runtime>/current -> <sha> (junction),
// <runtime>/cache (the shared query cache, linked in as <sha>/.cache), node_modules linked from the
// repo when present. `current` moves only after the export is complete.

import { mkdirSync, existsSync, readdirSync, rmSync, renameSync, symlinkSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { runtimeRoot as defaultRuntimeRoot } from './runtime-path.mjs';

const PUBLISH_SCRIPT = 'publish:runtime';
const DEFAULT_KEEP = 3;
const SHA_DIR = /^[0-9a-f]{7,40}$/;
const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';
const ARCHIVE_MAX_BYTES = 1 << 30;

const link = (target, path) => symlinkSync(target, path, LINK_TYPE);

/** The real directory `<runtimeRoot>/current` points at, or '' when nothing is published. */
export function currentRuntime(runtimeRoot) {
  try { return realpathSync(join(runtimeRoot, 'current')); } catch { return ''; }
}

function exportHead(repo, dest) {
  const tar = execFileSync('git', ['-C', repo, 'archive', '--format=tar', 'HEAD'], { maxBuffer: ARCHIVE_MAX_BYTES });
  mkdirSync(dest, { recursive: true });
  const r = spawnSync('tar', ['-x'], { cwd: dest, input: tar });
  if (r.status !== 0) throw new Error(`tar extract failed: ${r.stderr}`);
}

function repointCurrent(runtimeRoot, sha) {
  const tmpLink = join(runtimeRoot, `current.${process.pid}`);
  const current = join(runtimeRoot, 'current');
  rmSync(tmpLink, { recursive: true, force: true });
  link(join(runtimeRoot, sha), tmpLink);
  rmSync(current, { recursive: true, force: true }); // removes the link only, never its target
  renameSync(tmpLink, current);
}

function prune(runtimeRoot, keep, currentSha) {
  const dirs = readdirSync(runtimeRoot).filter((n) => SHA_DIR.test(n))
    .map((n) => ({ n, t: statSync(join(runtimeRoot, n)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const { n } of dirs.slice(keep)) if (n !== currentSha) rmSync(join(runtimeRoot, n), { recursive: true, force: true });
}

/** Export HEAD of `repo` and repoint `current`; throws before touching `current` if the export fails. */
export function publishRuntime({ repo, runtimeRoot = defaultRuntimeRoot(), keep = DEFAULT_KEEP }) {
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  mkdirSync(runtimeRoot, { recursive: true });
  const dir = join(runtimeRoot, sha);
  if (!existsSync(dir)) {
    const staging = join(runtimeRoot, `.staging-${sha}-${process.pid}`);
    try {
      exportHead(repo, staging);
      mkdirSync(join(runtimeRoot, 'cache'), { recursive: true });
      link(join(runtimeRoot, 'cache'), join(staging, '.cache'));
      if (existsSync(join(repo, 'node_modules'))) link(join(repo, 'node_modules'), join(staging, 'node_modules'));
      renameSync(staging, dir);
    } catch (e) {
      rmSync(staging, { recursive: true, force: true });
      throw e;
    }
  }
  repointCurrent(runtimeRoot, sha);
  prune(runtimeRoot, keep, sha);
  return { sha, dir, current: join(runtimeRoot, 'current') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (flag) => { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; };
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (process.env.npm_lifecycle_event !== PUBLISH_SCRIPT) {
    process.stderr.write('runtime-publish: refusing - run `npm run ' + PUBLISH_SCRIPT + '` so the suite is green before `current` moves.\n');
    process.exit(1);
  }
  try {
    const r = publishRuntime({ repo, runtimeRoot: arg('--runtime') || defaultRuntimeRoot(), keep: Number(arg('--keep')) || DEFAULT_KEEP });
    process.stdout.write(`runtime: ${r.sha} -> ${r.current}\nrun kit scripts from ${r.current}/scripts/ (q.mjs, t.mjs, cap.mjs)\n`);
  } catch (e) {
    process.stderr.write(`runtime-publish: ${e.message}\n`);
    process.exit(1);
  }
}
