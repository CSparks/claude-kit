#!/usr/bin/env node
// Tests for `q code|sym|file --registry <crate-version>` (KIT-T392) against a throwaway cargo
// registry (CARGO_HOME) and repo — the real ~/.cargo is never read.
// Run: node scripts/q-registry.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { registryRows, resolveCrate, takeRegistry } from './q-registry.mjs';
import { serverReply } from './q-client.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const base = mkdtempSync(join(tmpdir(), 'qreg-'));
const fwd = (p) => p.replace(/\\/g, '/');
const cargo = join(base, 'cargo');
const repo = join(base, 'repo');
const index = join(cargo, 'registry', 'src', 'index.crates.io-fake');
const put = (abs, text) => { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, text); };
const lock = (...pkgs) => pkgs.map(([n, v]) => `[[package]]\nname = "${n}"\nversion = "${v}"\n`).join('\n');

put(join(index, 'physx-0.25.1', 'src', 'body.rs'), 'pub struct Body {}\nimpl Body {\n    pub fn reset_forces(&mut self) {}\n}\n// RESET_FORCES note\n');
put(join(index, 'physx-0.25.1', 'src', 'lib.rs'), 'pub mod body;\n');
put(join(index, 'physx-0.25.1', 'README.md'), '# physx\nresets forces\n');
put(join(index, 'physx-0.33.0-alpha', 'src', 'body.rs'), 'pub fn reset_forces_v2() {}\n');
put(join(index, 'solo-0.4.0', 'src', 'lib.rs'), 'pub fn only_here() {}\n');
put(join(index, 'solo-extra-9.9.9', 'src', 'lib.rs'), 'pub fn only_here() {}\n');
put(join(index, 'loose-1.0.0', 'src', 'lib.rs'), 'pub fn loose_fn() {}\n');
put(join(index, 'loose-2.0.0', 'src', 'lib.rs'), 'pub fn loose_fn() {}\n');
put(join(repo, 'Cargo.lock'), lock(['physx', '0.25.1'], ['solo', '0.4.0'], ['dup', '1.0.0'], ['dup', '2.0.0']));
put(join(repo, 'sub', 'vendor', 'vend', 'Cargo.toml'), '[package]\nname = "vend"\nversion = "3.1.4"\n');
put(join(repo, 'sub', 'vendor', 'vend', 'src', 'lib.rs'), 'pub fn vendored_fn() {}\n');
put(join(repo, 'src', 'main.rs'), 'fn reset_forces() {}\n');

process.env.CARGO_HOME = cargo;
const ctx = { root: repo, cwd: repo };
const locs = (rows) => rows.map((r) => r.loc).filter(Boolean);

await test('takeRegistry splits both spellings out of the args', () => {
  assert.deepEqual(takeRegistry(['x', '--registry', 'a-1.0.0', '-i']), { spec: 'a-1.0.0', rest: ['x', '-i'] });
  assert.deepEqual(takeRegistry(['--registry=a-1.0.0', 'x']), { spec: 'a-1.0.0', rest: ['x'] });
  assert.equal(takeRegistry(['x']).spec, undefined);
});

await test('code: a crate-version spec hits in the registry, paths absolute, repo hits excluded', async () => {
  const rows = await registryRows('code', ['reset_forces', '--registry', 'physx-0.25.1', '--limit', '0'], ctx);
  assert.deepEqual(locs(rows), [`${fwd(index)}/physx-0.25.1/src/body.rs:3`]);
  assert.match(rows[0].text, /pub fn reset_forces/);
});

await test('code: -i, -w, --lang, --path and -C behave as in the repo verbs', async () => {
  const run = (...a) => registryRows('code', [...a, '--registry', 'physx-0.25.1', '--limit', '0'], ctx);
  assert.equal(locs(await run('RESET_FORCES', '-i', '--lang', 'rust')).length, 2);
  assert.equal(locs(await run('RESET_FORCES')).length, 1);
  assert.deepEqual(locs(await run('reset_forces', '--lang', 'md')), []);
  assert.deepEqual(locs(await run('forces', '--path', 'src', '--kind', 'doc')), []);
  assert.equal(locs(await run('forces', '--lang', 'md')).length, 1);
  assert.deepEqual(locs(await run('Body', '-w', '-C', '1', '--path', 'src/lib.rs')), []);
  assert.deepEqual(locs(await run('pub fn reset', '-C', '1')).map((l) => l.slice(l.lastIndexOf('/') + 1)), ['body.rs-2', 'body.rs:3', 'body.rs-4']);
  assert.deepEqual(locs(await run('forces', '-l')).map((l) => l.slice(l.lastIndexOf('/') + 1)).sort(), ['README.md', 'body.rs']);
});

await test('sym: definitions of the crate with absolute paths, --type filters', async () => {
  const rows = await registryRows('sym', ['reset_forces', '--registry', 'physx-0.25.1'], ctx);
  assert.deepEqual(locs(rows), [`${fwd(index)}/physx-0.25.1/src/body.rs:3`]);
  assert.equal(rows[0].type, 'fn');
  assert.deepEqual(locs(await registryRows('sym', ['--registry', 'physx-0.25.1', '--type', 'struct'], ctx)), [`${fwd(index)}/physx-0.25.1/src/body.rs:1`]);
});

await test('bare crate resolves to the one version Cargo.lock pins', async () => {
  assert.equal(resolveCrate('physx', ctx).label, 'physx-0.25.1');
  assert.deepEqual(locs(await registryRows('code', ['only_here', '--registry', 'solo'], ctx)), [`${fwd(index)}/solo-0.4.0/src/lib.rs:1`]);
});

await test('bare crate with no lock entry resolves to its single copy on disk', () => {
  assert.equal(resolveCrate('solo-extra', ctx).label, 'solo-extra-9.9.9');
});

await test('version ambiguity: two locked versions error, listing the candidates', () => {
  assert.throws(() => resolveCrate('dup', ctx), /locked at 2 versions: dup-1\.0\.0, dup-2\.0\.0/);
});

await test('version ambiguity: two unlocked copies on disk error, listing where they are', () => {
  assert.throws(() => resolveCrate('loose', ctx), (e) => /matches 2 copies/.test(e.message) && e.message.includes('loose-1.0.0') && e.message.includes('loose-2.0.0'));
});

await test('an absent crate or version errors with what is present', () => {
  assert.throws(() => resolveCrate('nothere', ctx), /no crate 'nothere'/);
  assert.throws(() => resolveCrate('physx-9.9.9', ctx), (e) => /not on disk/.test(e.message) && e.message.includes('physx-0.25.1'));
});

await test('a pre-release version spec names its own dir', () => {
  assert.equal(resolveCrate('physx-0.33.0-alpha', ctx).label, 'physx-0.33.0-alpha');
});

await test('vendor dir: a vendored crate is found by name and searched', async () => {
  assert.equal(resolveCrate('vend', ctx).label, 'vend-3.1.4');
  assert.deepEqual(locs(await registryRows('code', ['vendored_fn', '--registry', 'vend-3.1.4'], ctx)), [`${fwd(join(repo, 'sub', 'vendor', 'vend'))}/src/lib.rs:1`]);
});

await test('CLI: q code --registry end to end, paths absolute, one-line errors on ambiguity', () => {
  const env = { ...process.env, CARGO_HOME: cargo, CLAUDE_KIT_Q_SERVER: 'off', CLAUDE_KIT_CODE_INDEX_DIR: join(base, 'cache') };
  const q = (...a) => execFileSync(process.execPath, [join(import.meta.dirname, 'q.mjs'), '--root', repo, ...a], { encoding: 'utf8', env, cwd: repo });
  assert.match(q('code', 'reset_forces', '--registry', 'physx-0.25.1', '--lang', 'rust'), /physx-0\.25\.1\/src\/body\.rs:3 /);
  assert.match(q('sym', 'Body', '--registry=physx'), /body\.rs:1\s+struct\s+Body/);
  assert.throws(() => q('code', 'x', '--registry', 'dup'), (e) => /locked at 2 versions/.test(`${e.stderr}${e.stdout}`));
});

await test('the resident server is bypassed for --registry (it would search the repo)', async () => {
  assert.equal(await serverReply(['code', 'x', '--registry', 'physx-0.25.1'], repo), null);
  assert.equal(await serverReply(['code', 'x', '--registry=physx-0.25.1'], repo), null);
});

rmSync(base, { recursive: true, force: true });
console.log(`\nq-registry: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
