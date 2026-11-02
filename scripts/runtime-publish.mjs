#!/usr/bin/env node
// runtime-publish.mjs — seal the COMMITTED kit tree into a runtime directory sessions run from
// (KIT-T450). Writers edit the repo; every other session loads scripts and hooks from
// `<runtime>/current`, so a half-edited file is never loaded.
//
//   npm run publish:runtime        # exports HEAD, runs npm test there, then publishes: the ONLY way `current` moves.
//                                  # The working tree is never tested or published (KIT-T510).
//   node scripts/runtime-publish.mjs [--runtime <dir>] [--keep N]   # refuses outside that npm script
//   npm run publish:followup       # runs the owed remainder of a two-phase publish (publish-followup.mjs) and records the result;
//                                  # a failed or unfinished remainder refuses the next publish until this passes.
//
// Layout: <runtime>/<sha>/ (immutable `git archive HEAD`), <runtime>/current -> <sha> (junction),
// <runtime>/cache (the shared query cache, linked in as <sha>/.cache), node_modules linked from the
// repo when present. `current` moves only after the export is complete.

import { mkdirSync, existsSync, readdirSync, rmSync, renameSync, symlinkSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { runtimeRoot as defaultRuntimeRoot } from './runtime-path.mjs';
import { isMain } from './is-main.mjs';
import { liveUsers } from './runtime-pin.mjs';
import { installedPlugin, pluginDrift } from './plugin-drift.mjs';
import { heldRuntimes } from './runtime-holders.mjs';
import { referencedRuntimes } from './runtime-refs.mjs';
import { CHILD_OPTIONS, gitOrThrow, stopProcessesUnder, sweepScratch, withPublishLock } from './runtime-publish-guard.mjs';
import { claimFollowup, finishFollowup, followupBlocker, followupFiles, readFollowup } from './publish-followup.mjs';
import { followupSuite, launchFollowup, publishSuite } from './publish-suite.mjs';

const PUBLISH_SCRIPT = 'publish:runtime';
const DEFAULT_KEEP = 3;
const DEFAULT_GRACE_HOURS = 72;
const MS_PER_S = 1000;
const MS_PER_HOUR = 3600 * MS_PER_S;
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

function exportHead(repo, dest, ref = 'HEAD') {
  const tar = execFileSync('git', ['-C', repo, 'archive', '--format=tar', ref], { maxBuffer: ARCHIVE_MAX_BYTES, ...CHILD_OPTIONS });
  mkdirSync(dest, { recursive: true });
  const r = spawnSync('tar', ['-x'], { cwd: dest, input: tar, ...CHILD_OPTIONS });
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

// Tests expect a git checkout: the export becomes a one-commit repo (never the real history). The commit reuses the
// source repo's tree through an alternate object store, so it writes one commit object instead of one loose object per
// file (`git add -A` took 48 s on the Windows dev drive, 3 s elsewhere).
function initGit(dir, sha, repo, ref) {
  gitOrThrow(dir, ['init', '-q', '-b', 'main']);
  const objects = gitOrThrow(repo, ['rev-parse', '--path-format=absolute', '--git-path', 'objects']).trim();
  writeFileSync(join(dir, '.git', 'objects', 'info', 'alternates'), `${objects}\n`);
  const tree = gitOrThrow(repo, ['rev-parse', `${ref}^{tree}`]).trim();
  const commit = gitOrThrow(dir, ['commit-tree', tree, '-m', `export of ${sha}`]).trim();
  gitOrThrow(dir, ['update-ref', 'refs/heads/main', commit]);
  gitOrThrow(dir, ['read-tree', 'HEAD']);
}

// The repo's installed dependencies (root and each first-level package such as server/), linked into an export.
function linkModules(repo, dest) {
  for (const sub of ['', ...readdirSync(repo, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(repo, d.name, 'package.json'))).map((d) => d.name)]) {
    if (existsSync(join(repo, sub, 'node_modules')) && existsSync(join(dest, sub))) link(join(repo, sub, 'node_modules'), join(dest, sub, 'node_modules'));
  }
}

/** Export HEAD into a scratch dir beside the repo: outside the OS temp dir and any git tree, as the suite expects (own empty cache), run `verify(dir)` there, then delete it; a throw aborts the publish (KIT-T510). */
function verifyHead(repo, runtimeRoot, sha, verify, ref = 'HEAD') {
  const parent = dirname(resolve(repo));
  const scratch = join(parent, `.kit-verify-${sha}-${process.pid}`);
  const laps = [];
  const lap = (name, fn) => {
    const started = Date.now();
    try { return fn(); } finally { laps.push(`${name} ${((Date.now() - started) / MS_PER_S).toFixed(1)}s`); }
  };
  lap('sweep', () => sweepScratch(parent));
  try {
    lap('export', () => { exportHead(repo, scratch, ref); initGit(scratch, sha, repo, ref); linkModules(repo, scratch); });
    lap('suite', () => verify(scratch));
  } finally {
    lap('stop', () => stopProcessesUnder(scratch));
    lap('remove', () => rmSync(scratch, { recursive: true, force: true, maxRetries: SCRATCH_RM_RETRIES, retryDelay: SCRATCH_RM_DELAY_MS }));
    lap('sweep', () => sweepScratch(parent));
    process.stderr.write(`runtime-publish phases: ${laps.join(', ')}\n`);
  }
}

/** Export HEAD of `repo` and repoint `current`; `verify(dir)` tests the exported HEAD first, never the working tree. Throws before touching `current` if either fails. */
export function publishRuntime({ runtimeRoot = defaultRuntimeRoot(), ...options }) {
  return withPublishLock(runtimeRoot, () => publishLocked({ runtimeRoot, ...options }));
}

function publishLocked({ repo, runtimeRoot, keep = DEFAULT_KEEP, graceHours = DEFAULT_GRACE_HOURS, projects, verify, lines }) {
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', ...CHILD_OPTIONS }).trim();
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
  try { return execFileSync('git', ['-C', repo, 'diff', '--name-only', published, 'HEAD'], { encoding: 'utf8', ...CHILD_OPTIONS }).trim(); } catch { return undefined; }
}

const SELF = fileURLToPath(import.meta.url);

// Two-phase publish (KIT-T839): the nearest reached test files that fit the budget gate this publish; the reached
// files that did not fit run in a detached follow-up whose result gates the NEXT publish and shows at orient.
function publishMain(repo, runtimeRoot, keep) {
  const blocker = followupBlocker(runtimeRoot);
  if (blocker) throw new Error(`refusing to publish: ${blocker}`);
  let owed = [];
  const r = publishRuntime({ repo, runtimeRoot, keep, verify: (dir) => { owed = publishSuite(dir, { changed: changedSincePublished(repo, runtimeRoot) }); } });
  process.stdout.write(`runtime: ${r.sha} -> ${r.current}\nrun kit scripts from ${r.current}/scripts/ (q.mjs, t.mjs, cap.mjs)\n`);
  if (owed.length) {
    const pid = launchFollowup(SELF, runtimeRoot, r.sha, owed);
    process.stdout.write(`follow-up: ${owed.length} test file(s) the change reaches did not fit the publish budget; they run in pid ${pid} (log ${join(runtimeRoot, 'publish-followup.log')}). A failure blocks the next publish and shows at orient.\n`);
  }
  const drift = pluginDrift({ repo, installed: installedPlugin() });
  if (drift.length) process.stderr.write(`runtime-publish: ${drift.length} agent/skill/command/hook file(s) changed since the plugin cache was copied, under the same plugin.json version, so sessions do not see them. Bump .claude-plugin/plugin.json version, then restart sessions: ${drift.slice(0, 8).join(', ')}${drift.length > 8 ? ', ...' : ''}\n`);
}

// Runs the recorded remainder (the failed files of the last attempt, else all) on an export of `ref` and records the outcome.
function followupMain(repo, runtimeRoot, ref) {
  const record = readFollowup(runtimeRoot);
  if (!record) throw new Error('no publish follow-up is recorded');
  claimFollowup(runtimeRoot, process.pid);
  const sha = ref || gitOrThrow(repo, ['rev-parse', '--short', 'HEAD']).trim();
  let failed = [];
  verifyHead(repo, runtimeRoot, sha, (dir) => { failed = followupSuite(dir, followupFiles(record)); }, ref || 'HEAD');
  finishFollowup(runtimeRoot, { failed });
  process.stdout.write(failed.length ? `follow-up FAILED: ${failed.join(', ')}\n` : `follow-up passed: ${followupFiles(record).length} file(s)\n`);
  if (failed.length) process.exitCode = 1;
}

if (isMain(import.meta.url)) {
  const arg = (flag) => { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; };
  const repo = resolve(dirname(SELF), '..');
  const runtimeRoot = arg('--runtime') || defaultRuntimeRoot();
  const followup = process.argv.includes('--followup');
  if (!followup && process.env.npm_lifecycle_event !== PUBLISH_SCRIPT) {
    process.stderr.write('runtime-publish: refusing - run `npm run ' + PUBLISH_SCRIPT + '`, which tests the committed HEAD before `current` moves.\n');
    process.exit(1);
  }
  try {
    if (followup) followupMain(repo, runtimeRoot, arg('--followup')?.startsWith('--') ? undefined : arg('--followup'));
    else publishMain(repo, runtimeRoot, Number(arg('--keep')) || DEFAULT_KEEP);
  } catch (e) {
    process.stderr.write(`runtime-publish: ${e.message}\n`);
    process.exit(1);
  }
}
