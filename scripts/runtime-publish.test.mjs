#!/usr/bin/env node
// Tests for runtime-publish.mjs (KIT-T450): the sealed runtime holds the COMMITTED tree, never a
// writer's half-edit, and `current` moves only once a complete export exists.
// Run: node scripts/runtime-publish.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync, utimesSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { publishRuntime, currentRuntime } from './runtime-publish.mjs';
import { gitOrThrow } from './runtime-publish-guard.mjs';
import { liveUsers, pinRuntime } from './runtime-pin.mjs';
import { referencedRuntimes } from './runtime-refs.mjs';

const BS = String.fromCharCode(92);
const publish = (o) => publishRuntime({ graceHours: 0, lines: [], ...o });

let pass = 0;
let fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name); } };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const normalized = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

const tmp = mkdtempSync(join(tmpdir(), 'kit-runtime-'));
const repo = join(tmp, 'kit');
const runtimeRoot = join(tmp, 'runtime');
mkdirSync(join(repo, 'scripts'), { recursive: true });
git(repo, 'init', '-q');
git(repo, 'config', 'user.email', 't@t');
git(repo, 'config', 'user.name', 't');
writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 1;\n');
writeFileSync(join(repo, 'scripts', 'main.mjs'), "import { v } from './lib.mjs';\nconsole.log('v=' + v);\n");
git(repo, 'add', '.');
git(repo, 'commit', '-qm', 'one');
const sha1 = git(repo, 'rev-parse', '--short', 'HEAD');

writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = ;; half-edit\n');
const first = publish({ repo, runtimeRoot });
ok('the export is the committed tree, not the half-edited working tree', normalized(join(first.dir, 'scripts', 'lib.mjs')) === 'export const v = 1;\n');
ok('the exported script loads and runs', spawnSync(process.execPath, [join(runtimeRoot, 'current', 'scripts', 'main.mjs')], { encoding: 'utf8' }).stdout.trim() === 'v=1');
ok('current resolves to the sha directory', currentRuntime(runtimeRoot) === realpathSync(join(runtimeRoot, sha1)));

writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 2;\n');
git(repo, 'commit', '-aqm', 'two');
const sha2 = git(repo, 'rev-parse', '--short', 'HEAD');
publish({ repo, runtimeRoot });
ok('a second publish moves current to the new sha', currentRuntime(runtimeRoot) === realpathSync(join(runtimeRoot, sha2)));
ok('the previous sha stays for sessions still inside it', existsSync(join(runtimeRoot, sha1, 'scripts', 'lib.mjs')));

writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 3;\n');
git(repo, 'commit', '-aqm', 'three');
// KIT-T486: sha2 is pinned by this live process, sha1 by a dead pid.
pinRuntime(join(runtimeRoot, sha2));
mkdirSync(join(runtimeRoot, sha1, '.in-use'), { recursive: true });
writeFileSync(join(runtimeRoot, sha1, '.in-use', '999999'), 'dead');
publish({ repo, runtimeRoot, keep: 1 });
const shaDirs = () => readdirSync(runtimeRoot).filter((n) => /^[0-9a-f]{7,}$/.test(n));
ok('a runtime a live daemon pinned survives the prune', existsSync(join(runtimeRoot, sha2, 'scripts', 'lib.mjs')) && liveUsers(join(runtimeRoot, sha2)).includes(process.pid));
ok('negative control: a pin by a dead pid does not hold its runtime', !existsSync(join(runtimeRoot, sha1)));
rmSync(join(runtimeRoot, sha2, '.in-use'), { recursive: true, force: true });
writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 4;\n');
git(repo, 'commit', '-aqm', 'four');
publish({ repo, runtimeRoot, keep: 1 });
ok('keep prunes older sha directories once nothing pins them', shaDirs().length === 1);

// KIT-T486 follow-up: a daemon started before pins existed is found through its live broker lock;
// the copy `current` pointed at when it started is kept.
{
  const [heldSha] = shaDirs();
  const started = Date.now();
  utimesSync(join(runtimeRoot, heldSha), new Date(started - 60_000), new Date(started - 60_000));
  const proj = join(tmp, 'proj');
  mkdirSync(join(proj, '.ai'), { recursive: true });
  mkdirSync(join(proj, 'target', 'broker'), { recursive: true });
  const lock = (pid) => writeFileSync(join(proj, 'target', 'broker', 'broker.lock'), JSON.stringify({ pid, host: hostname(), ts: new Date(started).toISOString() }));
  lock(process.pid);
  for (const v of [5, 6]) {
    writeFileSync(join(repo, 'scripts', 'lib.mjs'), `export const v = ${v};\n`);
    git(repo, 'commit', '-aqm', `v${v}`);
    publish({ repo, runtimeRoot, keep: 1, projects: { proj } });
  }
  ok('a runtime current when a live, unpinned broker started survives the prune', existsSync(join(runtimeRoot, heldSha, 'scripts', 'lib.mjs')));
  lock(999999);
  writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 7;\n');
  git(repo, 'commit', '-aqm', 'v7');
  publish({ repo, runtimeRoot, keep: 1, projects: { proj } });
  ok('negative control: a dead broker lock holds nothing', !existsSync(join(runtimeRoot, heldSha)));
}

// KIT-T510: verify runs on an export of HEAD, so a dirty file outside HEAD neither fails nor leaks into the publish.
{
  const lib = join(repo, 'scripts', 'lib.mjs');
  const seen = [];
  writeFileSync(lib, 'export const v = 8;\n');
  git(repo, 'commit', '-aqm', 'v8');
  writeFileSync(join(repo, 'scripts', 'dirty.mjs'), 'half-edit ;;\n');
  writeFileSync(lib, 'export const v = ;; dirty\n');
  const r = publish({ repo, runtimeRoot, verify: (dir) => seen.push([dir, existsSync(join(dir, 'scripts', 'dirty.mjs')), normalized(join(dir, 'scripts', 'lib.mjs'))]) });
  ok('verify sees committed HEAD: no dirty file, committed content', seen.length === 1 && seen[0][1] === false && seen[0][2] === 'export const v = 8;\n');
  ok('the published runtime holds no dirty file', !existsSync(join(r.dir, 'scripts', 'dirty.mjs')) && normalized(join(r.dir, 'scripts', 'lib.mjs')) === 'export const v = 8;\n');
  ok('the scratch export is removed', !existsSync(seen[0][0]));
  git(repo, 'checkout', '--', 'scripts/lib.mjs');
  rmSync(join(repo, 'scripts', 'dirty.mjs'));
  const heldCurrent = currentRuntime(runtimeRoot);
  writeFileSync(lib, 'export const v = 9;\n');
  git(repo, 'commit', '-aqm', 'v9');
  let red = false;
  try { publish({ repo, runtimeRoot, verify: () => { throw new Error('red'); } }); } catch { red = true; }
  ok('negative control: a red verify throws and current does not move', red && currentRuntime(runtimeRoot) === heldCurrent);
}

// A session that calls a script by its sha path has no pin: the grace window and a command-line match keep that copy.
{
  const dirs = () => readdirSync(runtimeRoot).filter((n) => /^[0-9a-f]{7,}$/.test(n));
  const bump = (v) => { writeFileSync(join(repo, 'scripts', 'lib.mjs'), `export const v = ${v};
`); git(repo, 'commit', '-aqm', `g${v}`); };
  const old = basename(currentRuntime(runtimeRoot));
  bump(10);
  publishRuntime({ repo, runtimeRoot, keep: 1, lines: [] });
  ok('a copy younger than the grace window survives keep', existsSync(join(runtimeRoot, old)));
  bump(11);
  publish({ repo, runtimeRoot, keep: 1, lines: [`node ${runtimeRoot.replaceAll('/', BS)}${BS}${old}${BS}scripts${BS}t.mjs`] });
  ok('a copy a live process names on its command line survives', existsSync(join(runtimeRoot, old)));
  const msys = runtimeRoot.replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase()).replaceAll(BS, '/');
  ok('the msys path form of a command line names it too', referencedRuntimes(runtimeRoot, [`node ${msys}/${old}/scripts/t.mjs`]).has(old));
  bump(12);
  publish({ repo, runtimeRoot, keep: 1, lines: [] });
  ok('negative control: an old copy no process names is pruned', !existsSync(join(runtimeRoot, old)) && dirs().length === 1);
}

// KIT-T737: one publish at a time, git's own error text, and no scratch export left behind.
{
  const lock = join(runtimeRoot, 'publish.lock');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, host: hostname(), since: 'now' }));
  let message = '';
  try { publish({ repo, runtimeRoot }); } catch (e) { message = e.message; }
  ok('a live holder of the publish lock blocks a second publish and is named', message.includes(`pid ${process.pid}`) && existsSync(lock));
  const finished = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  writeFileSync(lock, JSON.stringify({ pid: Number(finished.stdout), host: hostname(), since: 'then' }));
  const again = publish({ repo, runtimeRoot });
  ok('negative control: a dead holder is taken over and the publish runs', Boolean(again.sha) && currentRuntime(runtimeRoot) === realpathSync(again.dir));
  ok('the lock is released after a publish, ok or red', !existsSync(lock));
  try { publish({ repo, runtimeRoot, verify: () => { throw new Error('red'); } }); } catch { /* red */ }
  ok('the lock is released after a red publish', !existsSync(lock));
  const notRepo = join(tmp, 'plain');
  mkdirSync(notRepo, { recursive: true });
  let gitMessage = '';
  try { gitOrThrow(notRepo, ['commit', '-q', '-m', 'x']); } catch (e) { gitMessage = e.message; }
  ok('a git failure carries git stderr', /not a git repository|fatal/i.test(gitMessage));
  const scratchParent = dirname(repo);
  ok('no .kit-verify scratch export stays beside the repo after the publishes', !readdirSync(scratchParent).some((n) => n.startsWith('.kit-verify-')));
}

const before = currentRuntime(runtimeRoot);
let threw = false;
try { publish({ repo: join(tmp, 'not-a-repo'), runtimeRoot }); } catch { threw = true; }
ok('a failed publish throws and leaves current untouched', threw && currentRuntime(runtimeRoot) === before);

rmSync(tmp, { recursive: true, force: true });
console.log(`\nruntime-publish: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
