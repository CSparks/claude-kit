#!/usr/bin/env node
// runtime-publish.mjs — seal the COMMITTED kit tree into a runtime directory sessions run from
// (KIT-T450). Writers edit the repo; every other session loads scripts and hooks from
// `<runtime>/current`, so a half-edited file is never loaded.
//
//   npm run publish:runtime        # exports HEAD, runs npm test there, then publishes: the ONLY way `current` moves.
//                                  # The working tree is never tested or published (KIT-T510).
//   node scripts/runtime-publish.mjs [--runtime <dir>] [--keep N]   # refuses outside that npm script
//
// Layout: <runtime>/<sha>/ (immutable `git archive HEAD`), <runtime>/current -> <sha> (junction),
// <runtime>/cache (the shared query cache, linked in as <sha>/.cache), node_modules linked from the
// repo when present. `current` moves only after the export is complete.

import { mkdirSync, existsSync, readdirSync, rmSync, renameSync, symlinkSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { runtimeRoot as defaultRuntimeRoot } from './runtime-path.mjs';
import { isMain } from './is-main.mjs';
import { liveUsers } from './runtime-pin.mjs';
import { installedPlugin, pluginDrift } from './plugin-drift.mjs';
import { heldRuntimes } from './runtime-holders.mjs';
import { referencedRuntimes } from './runtime-refs.mjs';
import { gitOrThrow, stopProcessesUnder, withPublishLock } from './runtime-publish-guard.mjs';

const PUBLISH_SCRIPT = 'publish:runtime';
const DEFAULT_KEEP = 3;
const DEFAULT_GRACE_HOURS = 72;
const MS_PER_HOUR = 3600 * 1000;
const SHA_DIR = /^[0-9a-f]{7,40}$/;
const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';
const ARCHIVE_MAX_BYTES = 1 << 30;
const SCRATCH_RM_RETRIES = 10;
const SCRATCH_RM_DELAY_MS = 300;

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

// A copy survives when it is current, one of the newest `keep`, younger than `graceHours` (a session
// started inside it keeps calling its scripts by path), pinned or lock-held by a daemon (KIT-T486),
// or named on a live process's command line.
function prune(runtimeRoot, { keep, currentSha, projects, graceHours, lines }) {
  const held = heldRuntimes(runtimeRoot, projects ? { projects } : {});
  const named = referencedRuntimes(runtimeRoot, lines);
  const dirs = readdirSync(runtimeRoot).filter((n) => SHA_DIR.test(n))
    .map((n) => ({ n, t: statSync(join(runtimeRoot, n)).mtimeMs })).sort((a, b) => b.t - a.t);
  const graceStart = Date.now() - graceHours * MS_PER_HOUR;
  for (const { n, t } of dirs.slice(keep)) {
    if (n === currentSha || t > graceStart || held.has(n) || named.has(n) || liveUsers(join(runtimeRoot, n)).length) continue;
    rmSync(join(runtimeRoot, n), { recursive: true, force: true });
  }
}

// Tests expect a git checkout: the export becomes a one-commit repo (never the real history).
function initGit(dir, sha) {
  gitOrThrow(dir, ['init', '-q', '-b', 'main']);
  gitOrThrow(dir, ['add', '-A']);
  gitOrThrow(dir, ['commit', '-q', '-m', `export of ${sha}`]);
}

// The repo's installed dependencies (root and each first-level package such as server/), linked into an export.
function linkModules(repo, dest) {
  for (const sub of ['', ...readdirSync(repo, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(repo, d.name, 'package.json'))).map((d) => d.name)]) {
    if (existsSync(join(repo, sub, 'node_modules')) && existsSync(join(dest, sub))) link(join(repo, sub, 'node_modules'), join(dest, sub, 'node_modules'));
  }
}

/** Export HEAD into a scratch dir beside the repo: outside the OS temp dir and any git tree, as the suite expects (own empty cache), run `verify(dir)` there, then delete it; a throw aborts the publish (KIT-T510). */
function verifyHead(repo, runtimeRoot, sha, verify) {
  const scratch = join(dirname(resolve(repo)), `.kit-verify-${sha}-${process.pid}`);
  try {
    exportHead(repo, scratch);
    initGit(scratch, sha);
    linkModules(repo, scratch);
    verify(scratch);
  } finally {
    stopProcessesUnder(scratch);
    rmSync(scratch, { recursive: true, force: true, maxRetries: SCRATCH_RM_RETRIES, retryDelay: SCRATCH_RM_DELAY_MS });
  }
}

/** Export HEAD of `repo` and repoint `current`; `verify(dir)` tests the exported HEAD first, never the working tree. Throws before touching `current` if either fails. */
export function publishRuntime({ runtimeRoot = defaultRuntimeRoot(), ...options }) {
  return withPublishLock(runtimeRoot, () => publishLocked({ runtimeRoot, ...options }));
}

function publishLocked({ repo, runtimeRoot, keep = DEFAULT_KEEP, graceHours = DEFAULT_GRACE_HOURS, projects, verify, lines }) {
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  mkdirSync(runtimeRoot, { recursive: true });
  const dir = join(runtimeRoot, sha);
  if (verify) verifyHead(repo, runtimeRoot, sha, verify);
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
  prune(runtimeRoot, { keep, currentSha: sha, projects, graceHours, lines });
  return { sha, dir, current: join(runtimeRoot, 'current') };
}

// Paths changed since the published runtime (`current`); undefined when nothing is published or git cannot say.
function changedSincePublished(repo, runtimeRoot) {
  const published = basename(currentRuntime(runtimeRoot));
  if (!SHA_DIR.test(published)) return undefined;
  try { return execFileSync('git', ['-C', repo, 'diff', '--name-only', published, 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return undefined; }
}

// The kit suite on the exported HEAD under the 5-minute budget (KIT-D104): the files the publish's change reaches,
// then the files run longest ago; the rest rotate in on later runs. Same npm script a writer runs.
function suiteOnExport(dir, changed) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const timesFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'test-times.json');
  const env = { ...process.env, KIT_TEST_TIMES: timesFile, ...(changed === undefined ? {} : { KIT_TEST_CHANGED: changed }) };
  const r = spawnSync(npm, ['test'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32', env });
  if (r.status !== 0) throw new Error(`the suite is red on exported HEAD (exit ${r.status}); current did not move`);
}

if (isMain(import.meta.url)) {
  const arg = (flag) => { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; };
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (process.env.npm_lifecycle_event !== PUBLISH_SCRIPT) {
    process.stderr.write('runtime-publish: refusing - run `npm run ' + PUBLISH_SCRIPT + '`, which tests the committed HEAD before `current` moves.\n');
    process.exit(1);
  }
  try {
    const r = publishRuntime({ repo, runtimeRoot: arg('--runtime') || defaultRuntimeRoot(), keep: Number(arg('--keep')) || DEFAULT_KEEP, verify: (dir) => suiteOnExport(dir, changedSincePublished(repo, arg('--runtime') || defaultRuntimeRoot())) });
    process.stdout.write(`runtime: ${r.sha} -> ${r.current}\nrun kit scripts from ${r.current}/scripts/ (q.mjs, t.mjs, cap.mjs)\n`);
    const drift = pluginDrift({ repo, installed: installedPlugin() });
    if (drift.length) process.stderr.write(`runtime-publish: ${drift.length} agent/skill/command/hook file(s) changed since the plugin cache was copied, under the same plugin.json version, so sessions do not see them. Bump .claude-plugin/plugin.json version, then restart sessions: ${drift.slice(0, 8).join(', ')}${drift.length > 8 ? ', ...' : ''}\n`);
  } catch (e) {
    process.stderr.write(`runtime-publish: ${e.message}\n`);
    process.exit(1);
  }
}
