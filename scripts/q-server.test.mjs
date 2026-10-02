#!/usr/bin/env node
// Tests for the resident q server (KIT-T290): a q call with no server leaves one running and
// the next call goes through it; answers are identical to the in-process path; an edit followed
// at once by a search is seen (create, modify, delete, rename); with the server off or down
// q still answers; concurrent clients get the same answer.
// Run: node scripts/q-server.test.mjs

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { serverReply, serverStats, stopServer } from './q-client.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const Q = join(import.meta.dirname, 'q.mjs');
const cache = mkdtempSync(join(tmpdir(), 'qs-cache-'));
const repo = mkdtempSync(join(tmpdir(), 'qs-repo-'));
const env = { ...process.env, CLAUDE_KIT_CODE_INDEX_DIR: cache, CLAUDE_KIT_Q_SERVER_IDLE_MS: '30000', CLAUDE_KIT_BUG_STORE: 'off' };
process.env.CLAUDE_KIT_CODE_INDEX_DIR = cache;
const put = (rel, text) => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), text); };
put('src/lib.rs', 'pub fn spawn_camp() {}\npub fn despawn_camp() {}\n');
put('src/camp.rs', 'pub struct Camp;\n');
put('docs/guide.md', '# guide\ncamp notes\n');
execFileSync('git', ['init', '-q'], { cwd: repo });
execFileSync('git', ['add', '-A'], { cwd: repo });

const q = (args, extra = {}) => spawnSync(process.execPath, [Q, ...args, '--root', repo], { cwd: repo, encoding: 'utf8', env: { ...env, ...extra } });
const out = (args, extra) => q(args, extra).stdout;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 8000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) { const v = await fn(); if (v) return v; }
  return null;
}

try {
  await test('no server: the first call answers in-process and leaves a server running', async () => {
    assert.equal(await serverStats(), null);
    assert.match(out(['code', 'spawn_camp']), /src\/lib\.rs:1/);
    assert.ok(await waitFor(serverStats), 'server came up after the first call');
  });

  await test('the next call goes through the server and prints the same answer', async () => {
    const before = (await serverStats()).served;
    const viaServer = out(['code', 'camp', '-i']);
    assert.equal((await serverStats()).served, before + 1);
    assert.equal(viaServer, out(['code', 'camp', '-i'], { CLAUDE_KIT_Q_SERVER: 'off' }));
    for (const args of [['sym', 'spawn_camp'], ['file', 'camp'], ['code', 'fn (spawn|despawn)_camp', '--regex'], ['code', 'camp', '--json']]) {
      assert.equal(out(args), out(args, { CLAUDE_KIT_Q_SERVER: 'off' }), args.join(' '));
    }
  });

  await test('edit then search at once sees the edit: create, modify, delete, rename', async () => {
    for (let i = 0; i < 12; i++) {
      const token = `zz_token_${i}`;
      put(`src/new${i}.rs`, `fn ${token}() {}\n`);
      assert.match(out(['code', token]), new RegExp(`src/new${i}\\.rs:1`), `create ${i}`);
      put(`src/new${i}.rs`, `fn ${token}_changed() {}\n`);
      assert.match(out(['code', `${token}_changed`]), new RegExp(`src/new${i}\\.rs:1`), `modify ${i}`);
      renameSync(join(repo, `src/new${i}.rs`), join(repo, `src/moved${i}.rs`));
      const moved = out(['code', `${token}_changed`]);
      assert.match(moved, new RegExp(`src/moved${i}\\.rs:1`), `rename ${i}`);
      assert.doesNotMatch(moved, new RegExp(`src/new${i}\\.rs`), `rename ${i} drops the old path`);
      unlinkSync(join(repo, `src/moved${i}.rs`));
      assert.match(out(['code', `${token}_changed`]), /no results/, `delete ${i}`);
    }
    assert.ok((await serverStats()).served > 40, 'those searches went through the server');
  });

  await test('back-to-back edit and search (no process spawn between) is never stale', async () => {
    const find = async (token) => (await serverReply(['code', token, '--root', repo], repo)).rows.filter((r) => r.loc);
    for (let i = 0; i < 60; i++) {
      const token = `tight_${i}_marker`;
      put(`src/tight${i}.rs`, `fn ${token}() {}\n`);
      assert.equal((await find(token)).length, 1, `create ${i}`);
      put(`src/tight${i}.rs`, 'fn gone() {}\n');
      assert.equal((await find(token)).length, 0, `modify ${i}`);
      unlinkSync(join(repo, `src/tight${i}.rs`));
      assert.equal((await find('gone')).length, 0, `delete ${i}`);
    }
  });

  await test('two concurrent clients get the same answer', async () => {
    const run = () => new Promise((resolve) => {
      const p = spawn(process.execPath, [Q, 'code', 'camp', '-i', '--root', repo], { cwd: repo, env });
      let text = '';
      p.stdout.on('data', (d) => { text += d; });
      p.on('close', () => resolve(text));
    });
    const before = (await serverStats()).served;
    const [a, b, c] = await Promise.all([run(), run(), run()]);
    assert.ok(a.includes('src/camp.rs'));
    assert.equal(a, b);
    assert.equal(b, c);
    assert.equal((await serverStats()).served, before + 3);
  });

  await test('server stopped: q still answers (in-process) and brings a server back', async () => {
    assert.equal(await stopServer(), true);
    assert.equal(await serverStats(), null);
    assert.match(out(['code', 'spawn_camp']), /src\/lib\.rs:1/);
    assert.ok(await waitFor(serverStats), 'a server was started again');
  });

  await test('CLAUDE_KIT_Q_SERVER=off never starts or uses a server', async () => {
    await stopServer();
    assert.match(out(['code', 'spawn_camp'], { CLAUDE_KIT_Q_SERVER: 'off' }), /src\/lib\.rs:1/);
    await sleep(500);
    assert.equal(await serverStats(), null);
  });

  await test('a flag q does not take falls back to the in-process report', () => {
    const r = q(['code', 'camp', '--bogus'], { CLAUDE_KIT_Q_SERVER: 'off' });
    assert.match(r.stdout, /does not take --bogus/);
  });
} finally {
  await stopServer();
  await sleep(300);
  for (const d of [cache, repo]) try { rmSync(d, { recursive: true, force: true }); } catch { /* still locked: temp dir */ }
}

console.log(`\nq-server: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
