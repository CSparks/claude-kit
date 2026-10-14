#!/usr/bin/env node
// Tests for runtime-publish.mjs (KIT-T450): the sealed runtime holds the COMMITTED tree, never a
// writer's half-edit, and `current` moves only once a complete export exists.
// Run: node scripts/runtime-publish.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync, utimesSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { publishRuntime, currentRuntime } from './runtime-publish.mjs';
import { liveUsers, pinRuntime } from './runtime-pin.mjs';

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
const first = publishRuntime({ repo, runtimeRoot });
ok('the export is the committed tree, not the half-edited working tree', normalized(join(first.dir, 'scripts', 'lib.mjs')) === 'export const v = 1;\n');
ok('the exported script loads and runs', spawnSync(process.execPath, [join(runtimeRoot, 'current', 'scripts', 'main.mjs')], { encoding: 'utf8' }).stdout.trim() === 'v=1');
ok('current resolves to the sha directory', currentRuntime(runtimeRoot) === realpathSync(join(runtimeRoot, sha1)));

writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 2;\n');
git(repo, 'commit', '-aqm', 'two');
const sha2 = git(repo, 'rev-parse', '--short', 'HEAD');
publishRuntime({ repo, runtimeRoot });
ok('a second publish moves current to the new sha', currentRuntime(runtimeRoot) === realpathSync(join(runtimeRoot, sha2)));
ok('the previous sha stays for sessions still inside it', existsSync(join(runtimeRoot, sha1, 'scripts', 'lib.mjs')));

writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 3;\n');
git(repo, 'commit', '-aqm', 'three');
// KIT-T486: sha2 is pinned by this live process, sha1 by a dead pid.
pinRuntime(join(runtimeRoot, sha2));
mkdirSync(join(runtimeRoot, sha1, '.in-use'), { recursive: true });
writeFileSync(join(runtimeRoot, sha1, '.in-use', '999999'), 'dead');
publishRuntime({ repo, runtimeRoot, keep: 1 });
const shaDirs = () => readdirSync(runtimeRoot).filter((n) => /^[0-9a-f]{7,}$/.test(n));
ok('a runtime a live daemon pinned survives the prune', existsSync(join(runtimeRoot, sha2, 'scripts', 'lib.mjs')) && liveUsers(join(runtimeRoot, sha2)).includes(process.pid));
ok('negative control: a pin by a dead pid does not hold its runtime', !existsSync(join(runtimeRoot, sha1)));
rmSync(join(runtimeRoot, sha2, '.in-use'), { recursive: true, force: true });
writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 4;\n');
git(repo, 'commit', '-aqm', 'four');
publishRuntime({ repo, runtimeRoot, keep: 1 });
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
    publishRuntime({ repo, runtimeRoot, keep: 1, projects: { proj } });
  }
  ok('a runtime current when a live, unpinned broker started survives the prune', existsSync(join(runtimeRoot, heldSha, 'scripts', 'lib.mjs')));
  lock(999999);
  writeFileSync(join(repo, 'scripts', 'lib.mjs'), 'export const v = 7;\n');
  git(repo, 'commit', '-aqm', 'v7');
  publishRuntime({ repo, runtimeRoot, keep: 1, projects: { proj } });
  ok('negative control: a dead broker lock holds nothing', !existsSync(join(runtimeRoot, heldSha)));
}

const before = currentRuntime(runtimeRoot);
let threw = false;
try { publishRuntime({ repo: join(tmp, 'not-a-repo'), runtimeRoot }); } catch { threw = true; }
ok('a failed publish throws and leaves current untouched', threw && currentRuntime(runtimeRoot) === before);

rmSync(tmp, { recursive: true, force: true });
console.log(`\nruntime-publish: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
