#!/usr/bin/env node
// Tests for runtime-publish.mjs (KIT-T450): the sealed runtime holds the COMMITTED tree, never a
// writer's half-edit, and `current` moves only once a complete export exists.
// Run: node scripts/runtime-publish.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { publishRuntime, currentRuntime } from './runtime-publish.mjs';

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
publishRuntime({ repo, runtimeRoot, keep: 1 });
ok('keep prunes older sha directories', readdirSync(runtimeRoot).filter((n) => /^[0-9a-f]{7,}$/.test(n)).length === 1);

const before = currentRuntime(runtimeRoot);
let threw = false;
try { publishRuntime({ repo: join(tmp, 'not-a-repo'), runtimeRoot }); } catch { threw = true; }
ok('a failed publish throws and leaves current untouched', threw && currentRuntime(runtimeRoot) === before);

rmSync(tmp, { recursive: true, force: true });
console.log(`\nruntime-publish: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
