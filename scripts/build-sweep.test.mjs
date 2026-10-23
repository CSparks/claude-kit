#!/usr/bin/env node
// build-sweep.test.mjs — the nightly cargo build-dir sweep (KIT-T636) against a fixture tree.
// Run: node scripts/build-sweep.test.mjs

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBuildDirs } from './build-sweep/discover.mjs';
import { parseName, staleItems } from './build-sweep/generations.mjs';
import { lastReceipt } from './build-sweep/receipt.mjs';
import { launchdPlist, windowsRegisterScript } from './build-sweep/schedule.mjs';
import { sweep } from './build-sweep/sweep.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'build-sweep.mjs');
const DAY = 86400000;
const NOW = Date.now();
const H = { a: 'aaaaaaaaaaaaaaaa', b: 'bbbbbbbbbbbbbbbb' };
const INC = { old: '1a2b3c4d5e6f7', mid: '2a2b3c4d5e6f7', new: '3a2b3c4d5e6f7' };
let passed = 0;
const ok = (name, cond) => { assert.ok(cond, name); passed += 1; };
const same = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed += 1; };
const posix = (p) => p.split(sep).join('/');

const put = (path, ageDays, ageMs = 0) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'xxxx');
  const t = new Date(NOW - ageDays * DAY - ageMs);
  utimesSync(path, t, t);
};
// A directory's mtime becomes that of its newest entry, as a real build tree's would be.
const settleDirs = (dir) => {
  let newest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    newest = Math.max(newest, e.isDirectory() ? settleDirs(p) : statSync(p).mtimeMs);
  }
  const t = new Date(newest);
  utimesSync(dir, t, t);
  return newest;
};

const tag = (path, ageDays) => {
  put(path, ageDays);
  writeFileSync(path, ['Signature: 8a477f597d28d172789f06886806bc55', '# This file is a cache directory tag created by cargo.', ''].join(String.fromCharCode(10)));
  const t = new Date(NOW - ageDays * DAY);
  utimesSync(path, t, t);
};
const dep = (prof, crate, hash, ageDays, ageMs = 0) => {
  put(join(prof, 'deps', `lib${crate}-${hash}.rlib`), ageDays, ageMs);
  put(join(prof, 'deps', `${crate}-${hash}.d`), ageDays, ageMs);
};
const fingerprint = (prof, crate, hash, ageDays) => put(join(prof, '.fingerprint', `${crate}-${hash}`, 'invoked.timestamp'), ageDays);
const buildOut = (prof, crate, hash, ageDays) => put(join(prof, 'build', `${crate}-${hash}`, 'output'), ageDays);
const session = (prof, crate, hash, ageDays) => put(join(prof, 'incremental', `${crate}-${hash}`, 's-1-abc', 'dep-graph.bin'), ageDays);

// unit: names and generations
same('artifact name', parseName(`libserde-${H.a}.rlib`), { crate: 'serde', hash: H.a });
same('d file groups with the rlib', parseName(`serde-${H.a}.d`), { crate: 'serde', hash: H.a });
same('crate containing lib keeps its name', parseName(`liblibc-${H.a}.rlib`), { crate: 'libc', hash: H.a });
same('unhashed name is not an artifact', parseName('libfoo.rlib'), null);
const gen = (hash, mtimeMs) => ({ crate: 'x', hash, mtimeMs });
same('only the older generation is stale', staleItems([gen('1', 0), gen('2', 100 * DAY)]).map((i) => i.hash), ['1']);
same('a lone old generation survives', staleItems([gen('1', 0)]), []);
same('same-build siblings survive', staleItems([gen('1', 0), gen('2', 60000)]), []);

// fixture
const root = mkdtempSync(join(tmpdir(), 'sweep-'));
const R = (...p) => join(root, ...p);

const a = R('repoA', 'target', 'debug');
tag(R('repoA', 'target', 'CACHEDIR.TAG'), 40);
put(R('repoA', 'Cargo.toml'), 0);
dep(a, 'serde', H.a, 30);
dep(a, 'serde', H.b, 20);
dep(a, 'rand', H.a, 40);
dep(a, 'syn', H.a, 1);
dep(a, 'syn', H.b, 1, 600000);
fingerprint(a, 'serde', H.a, 30);
fingerprint(a, 'serde', H.b, 20);
buildOut(a, 'serde', H.a, 30);
buildOut(a, 'serde', H.b, 20);
session(a, 'game', INC.old, 12);
session(a, 'game', INC.mid, 6);
session(a, 'game', INC.new, 2);
session(a, 'tool', INC.old, 3);
put(join(a, 'game.exe'), 0);

const deep = R('repoA', 'rapid-game', 'rust', 'sub', 'lib', 'target');
put(R('repoA', 'rapid-game', 'rust', 'sub', 'lib', 'Cargo.toml'), 0);
dep(join(deep, 'debug'), 'bevy', H.a, 9);
dep(join(deep, 'debug'), 'bevy', H.b, 3);
fingerprint(join(deep, 'debug'), 'bevy', H.b, 3);
tag(join(deep, 'CACHEDIR.TAG'), 9);

put(R('repoB', 'Cargo.toml'), 0);
tag(R('repoB', 'target', 'CACHEDIR.TAG'), 60);
tag(R('repoB', 'target-lanes', 'lane-idle', 'CACHEDIR.TAG'), 20);
tag(R('repoB', 'target-lanes', 'lane-fresh', 'CACHEDIR.TAG'), 0);
tag(R('repoB', 'target-fresh', 'CACHEDIR.TAG'), 5);
tag(R('repoB', 'build-target', 'CACHEDIR.TAG'), 20);
dep(R('repoB', 'target', 'debug'), 'old', H.a, 60);
dep(R('repoB', 'target', 'debug'), 'old', H.b, 59);
fingerprint(R('repoB', 'target', 'debug'), 'old', H.b, 59);
const idle = R('repoB', 'target-lanes', 'lane-idle', 'debug');
const fresh = R('repoB', 'target-lanes', 'lane-fresh', 'debug');
dep(idle, 'x', H.a, 20);
fingerprint(idle, 'x', H.a, 20);
dep(fresh, 'x', H.a, 1);
dep(fresh, 'x', H.b, 0);
fingerprint(fresh, 'x', H.b, 0);
tag(R('repoB', 'target-old', 'CACHEDIR.TAG'), 30);
dep(R('repoB', 'target-old', 'debug'), 'x', H.a, 30);
fingerprint(R('repoB', 'target-old', 'debug'), 'x', H.a, 30);
dep(R('repoB', 'target-fresh', 'debug'), 'x', H.a, 5);
fingerprint(R('repoB', 'target-fresh', 'debug'), 'x', H.a, 5);
dep(R('repoB', 'build-target', 'release'), 'x', H.a, 20);
fingerprint(R('repoB', 'build-target', 'release'), 'x', H.a, 20);

put(R('repoC', 'Cargo.toml'), 0);
tag(R('repoC', 'target', 'CACHEDIR.TAG'), 30);
dep(R('repoC', 'target', 'debug'), 'serde', H.a, 30);
dep(R('repoC', 'target', 'debug'), 'serde', H.b, 1);
put(R('repoC', 'target', 'broker', 'broker.lock'), 0);
writeFileSync(R('repoC', 'target', 'broker', 'broker.lock'), JSON.stringify({ pid: process.pid, host: hostname() }));

put(R('repoD', 'Cargo.toml'), 0);
dep(R('repoD', 'node_modules', 'pkg', 'target', 'debug'), 'serde', H.a, 30);
dep(R('repoD', 'node_modules', 'pkg', 'target', 'debug'), 'serde', H.b, 1);

put(R('repoE', 'Cargo.toml'), 0);
tag(R('repoE', '.claude', 'worktrees', 'w1', 'target', 'CACHEDIR.TAG'), 20);
const wt = R('repoE', '.claude', 'worktrees', 'w1', 'target', 'debug');
put(R('repoE', '.claude', 'worktrees', 'w1', 'Cargo.toml'), 20);
dep(wt, 'x', H.a, 20);
fingerprint(wt, 'x', H.a, 20);

put(R('repoF', 'Cargo.toml'), 0);
tag(R('repoF', 'target', 'CACHEDIR.TAG'), 30);
dep(R('repoF', 'target', 'debug'), 'serde', H.a, 30);
dep(R('repoF', 'target', 'debug'), 'serde', H.b, 1);

put(R('repoG', 'notes', 'release', 'readme.txt'), 90);
put(R('repoG', 'notes', 'debug', 'readme.txt'), 90);

// repoH: dirs that look idle and target-shaped but must survive
put(R('repoH', 'Cargo.toml'), 0);
const planted = R('repoH', 'target-planted');
dep(join(planted, 'debug'), 'serde', H.a, 30);
dep(join(planted, 'debug'), 'serde', H.b, 20);
fingerprint(join(planted, 'debug'), 'serde', H.a, 30);
put(join(planted, 'CACHEDIR.TAG'), 30);
writeFileSync(join(planted, 'CACHEDIR.TAG'), '# created by cargo, honest');
const manifest = R('repoH', 'target-manifest');
dep(join(manifest, 'debug'), 'x', H.a, 30);
fingerprint(join(manifest, 'debug'), 'x', H.a, 30);
tag(join(manifest, 'CACHEDIR.TAG'), 30);
put(join(manifest, 'Cargo.toml'), 30);
const tracked = R('repoH', 'target-tracked');
dep(join(tracked, 'debug'), 'x', H.a, 30);
fingerprint(join(tracked, 'debug'), 'x', H.a, 30);
tag(join(tracked, 'CACHEDIR.TAG'), 30);
const deepFresh = R('repoH', 'target-deepfresh');
dep(join(deepFresh, 'debug'), 'x', H.a, 30);
fingerprint(join(deepFresh, 'debug'), 'x', H.a, 30);
tag(join(deepFresh, 'CACHEDIR.TAG'), 30);
put(join(deepFresh, 'doc', 'a', 'b', 'c', 'fresh.html'), 1);

const repos = ['repoA', 'repoB', 'repoC', 'repoD', 'repoE', 'repoF', 'repoG', 'repoH'];
for (const r of repos) execFileSync('git', ['init', '-q'], { cwd: R(r) });
execFileSync('git', ['add', '-f', 'target-tracked/CACHEDIR.TAG'], { cwd: R('repoH') });
for (const t of repos) settleDirs(R(t));
const old = new Date(NOW - 30 * DAY);
for (const d of [deepFresh, join(deepFresh, 'doc'), join(deepFresh, 'doc', 'a'), join(deepFresh, 'doc', 'a', 'b'), join(deepFresh, 'doc', 'a', 'b', 'c')]) utimesSync(d, old, old);

const listAll = (dir, out = new Set()) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    out.add(posix(relative(root, p)));
    if (e.isDirectory()) listAll(p, out);
  }
  return out;
};
const topRemoved = (before, after) => {
  const gone = new Set([...before].filter((p) => !after.has(p)));
  return [...gone].filter((p) => !gone.has(p.slice(0, p.lastIndexOf('/')))).sort();
};

// discovery
const found = findBuildDirs(root).flatMap(function flat(b) { return [b, ...b.lanes.flatMap(flat)]; }).map((b) => posix(relative(root, b.dir)));
ok('depth-6 submodule target found', found.includes('repoA/rapid-game/rust/sub/lib/target'));
ok('node_modules is pruned', !found.some((p) => p.includes('node_modules')));
ok('worktree target found', found.includes('repoE/.claude/worktrees/w1/target'));
ok('a notes/release dir without cargo markers is not a build dir', !found.some((p) => p.startsWith('repoG')));
ok('an unsigned planted tag is found but not verified', findBuildDirs(R('repoH')).find((b) => b.dir === planted).cargo === false);
ok('a signed tag with a fingerprint is verified', findBuildDirs(R('repoH')).find((b) => b.dir === manifest).cargo === true);
ok('lane dirs found beneath a plain parent', found.includes('repoB/target-lanes/lane-idle') && found.includes('repoB/target-lanes/lane-fresh'));

// sweep
const snapshot = { commands: [`cargo build ${posix(root).toLowerCase()}/repof`] };
const before = listAll(root);
const dry = sweep(root, { dryRun: true, now: NOW, snapshot });
same('dry run touches nothing', listAll(root), before);
ok('dry run counts removals', dry.removed > 0 && dry.bytes > 0 && dry.dryRun);

const real = sweep(root, { dryRun: false, now: NOW, snapshot });
const ap = 'repoA/target/debug';
const bevy = 'repoA/rapid-game/rust/sub/lib/target/debug/deps';
same('exact removals', topRemoved(before, listAll(root)), [
  `${ap}/deps/libserde-${H.a}.rlib`,
  `${ap}/deps/serde-${H.a}.d`,
  `${ap}/.fingerprint/serde-${H.a}`,
  `${ap}/build/serde-${H.a}`,
  `${ap}/incremental/game-${INC.old}`,
  `${ap}/incremental/game-${INC.mid}`,
  `${bevy}/libbevy-${H.a}.rlib`,
  `${bevy}/bevy-${H.a}.d`,
  'repoB/build-target',
  'repoB/target-lanes/lane-idle',
  `repoB/target-lanes/lane-fresh/debug/deps/libx-${H.a}.rlib`,
  `repoB/target-lanes/lane-fresh/debug/deps/x-${H.a}.d`,
  'repoB/target-old',
  `repoB/target/debug/deps/libold-${H.a}.rlib`,
  `repoB/target/debug/deps/old-${H.a}.d`,
  'repoE/.claude/worktrees/w1/target',
].sort());
ok('real run matches the dry run totals', real.removed === dry.removed && real.bytes === dry.bytes);
same('whole idle dirs counted', real.wholeDirs, 4);
ok('planted cargo-text tag without the signature: kept and not pruned', existsSync(join(planted, 'debug', 'deps', `libserde-${H.a}.rlib`)) && real.unverified === 1);
ok('signature-tagged dir containing Cargo.toml is kept', existsSync(manifest) && existsSync(join(manifest, 'debug', 'deps', `libx-${H.a}.rlib`)));
ok('git-tracked target-shaped dir is kept', existsSync(join(tracked, 'CACHEDIR.TAG')) && existsSync(join(tracked, 'debug', 'deps', `libx-${H.a}.rlib`)));
ok('idle dir with one fresh deeply nested file is kept', existsSync(join(deepFresh, 'doc', 'a', 'b', 'c', 'fresh.html')) && existsSync(join(deepFresh, 'debug', 'deps', `libx-${H.a}.rlib`)));

const solo = mkdtempSync(join(tmpdir(), 'sweep-root-'));
const soloRoot = join(solo, 'target-root');
dep(join(soloRoot, 'debug'), 'x', H.a, 30);
fingerprint(join(soloRoot, 'debug'), 'x', H.a, 30);
tag(join(soloRoot, 'CACHEDIR.TAG'), 30);
settleDirs(soloRoot);
sweep(soloRoot, { now: NOW, snapshot: { commands: [] } });
ok('the scan root is never deleted', existsSync(join(soloRoot, 'debug', 'deps', `libx-${H.a}.rlib`)));
rmSync(solo, { recursive: true, force: true });
same('repos with a live lock or running cargo are skipped', real.skipped.map((s) => s.repo).sort(), ['repoC', 'repoF']);
ok('the live broker lock names itself', real.skipped.some((s) => s.repo === 'repoC' && /broker lock/.test(s.reason)));
ok('a running cargo names its repo', real.skipped.some((s) => s.repo === 'repoF' && /running/.test(s.reason)));
ok('newest generation survives even when old', existsSync(R('repoA', 'target', 'debug', 'deps', `libserde-${H.b}.rlib`)) && existsSync(R('repoA', 'target', 'debug', 'deps', `librand-${H.a}.rlib`)));
ok('same-build sibling generation survives', existsSync(R('repoA', 'target', 'debug', 'deps', `libsyn-${H.a}.rlib`)));
ok('primary target is pruned, never deleted whole', existsSync(R('repoB', 'target')));
ok('fresh sibling build dir kept', existsSync(R('repoB', 'target-fresh', 'debug', 'deps', `libx-${H.a}.rlib`)));

const unknown = sweep(root, { dryRun: true, now: NOW, snapshot: { commands: ['cargo.exe build'] } });
ok('a cargo process with an unknown owner defers every repo', unknown.removed === 0 && unknown.skipped.length > 0 && Object.keys(unknown.repos).length === 0);

// CLI: --json receipt and the log line
const home = mkdtempSync(join(tmpdir(), 'sweep-home-'));
const env = { ...process.env, CLAUDE_KIT_SWEEP_HOME: home };
const cli = spawnSync(process.execPath, [SCRIPT, root, '--json'], { encoding: 'utf8', env });
const printed = JSON.parse(cli.stdout);
ok('CLI prints a JSON receipt and exits 0', cli.status === 0 && printed.root === root && printed.dryRun === false);
const logFile = join(home, 'build-sweep.log');
ok('a real run appends exactly one log line', readFileSync(logFile, 'utf8').trim().split('\n').length === 1);
const dryCli = spawnSync(process.execPath, [SCRIPT, root, '--dry-run'], { encoding: 'utf8', env });
ok('dry run prints a receipt and logs nothing', dryCli.status === 0 && /dry run/.test(dryCli.stdout) && readFileSync(logFile, 'utf8').trim().split('\n').length === 1);
process.env.CLAUDE_KIT_SWEEP_HOME = home;
ok('lastReceipt reads the newest line', lastReceipt().root === root);

// scheduler artifacts
const ps = windowsRegisterScript();
ok('windows task runs at 03:30, on battery, catching missed runs', /03:30/.test(ps) && /AllowStartIfOnBatteries/.test(ps) && /StartWhenAvailable/.test(ps));
const plist = launchdPlist('/n', '/s');
ok('launchd plist fires at 03:30', /<key>Hour<\/key><integer>3<\/integer>/.test(plist) && /<key>Minute<\/key><integer>30<\/integer>/.test(plist));

rmSync(root, { recursive: true, force: true });
rmSync(home, { recursive: true, force: true });
console.log(`build-sweep: ${passed} passed, 0 failed`);
