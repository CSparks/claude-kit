#!/usr/bin/env node
// t-receipt.test.mjs — `t receipt` (KIT-T1144): the landing receipt skeleton lists, per repo and submodule, each
// landed commit's sha, cited tickets and push state, then the UAT line to fill; nothing landed prints one line.
// Run: node scripts/t-receipt.test.mjs

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitRoot } from '../hooks/lib/paths.mjs';
import { LAND_SLOT, LOCAL_ONLY, NOT_PUSHED, PUSHED } from '../hooks/lib/landed-commits.mjs';
import { writeTurnState } from '../hooks/lib/turn-state.mjs';

const T = join(dirname(fileURLToPath(import.meta.url)), 't.mjs');
const STATE_DIR = mkdtempSync(join(tmpdir(), 'receipt-ts-'));
process.env.CLAUDE_KIT_TURN_STATE = STATE_DIR;
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };

const git = (cwd, ...args) => execFileSync('git', ['-c', 'protocol.file.allow=always', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tmp = (prefix) => mkdtempSync(join(tmpdir(), prefix));

function repo(prefix = 'receipt-') {
  const dir = tmp(prefix);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  return dir;
}

function commit(dir, file, message) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), `${message}\n`);
  git(dir, 'add', file);
  git(dir, 'commit', '-q', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

const receipt = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [T, 'receipt', ...args], { cwd, encoding: 'utf8', env: process.env });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

ok('a landed commit in a repo with no remote prints sha, ticket and "local only (no remote)", then the line to fill', () => {
  const d = repo();
  const sha = commit(d, 'src/a.ts', 'feat: a KIT-T1');
  const r = receipt(d);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes(`${sha.slice(0, 7)} feat: a KIT-T1 | KIT-T1 | ${LOCAL_ONLY}`), r.out);
  assert.ok(r.out.includes('UAT / no-test (fill one)'), r.out);
  assert.ok(r.out.includes('last 60 minutes by this git user'), r.out);
});

ok('a commit citing two tickets lists both', () => {
  const d = repo();
  commit(d, 'src/b.ts', 'fix: b KIT-T7 and KIT-T9');
  const r = receipt(d, '--since', '30m');
  assert.ok(r.out.includes('| KIT-T7, KIT-T9 |'), r.out);
  assert.ok(r.out.includes('by any author (--since)'), r.out);
});

ok('a commit citing no ticket says so', () => {
  const d = repo();
  commit(d, 'src/c.ts', 'chore: c');
  assert.ok(receipt(d).out.includes('| no ticket cited |'));
});

ok('a pushed submodule commit shows pushed, an unpushed one not pushed, the remote-less parent local only', () => {
  const bare = tmp('receipt-bare-');
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  const seed = repo('receipt-seed-');
  commit(seed, 'src/seed.ts', 'seed KIT-T0');
  git(seed, 'remote', 'add', 'origin', bare);
  git(seed, 'push', '-q', '-u', 'origin', 'main');

  const parent = repo('receipt-parent-');
  git(parent, 'submodule', 'add', '-q', bare, 'libs/sub');
  const sub = join(parent, 'libs', 'sub');
  git(sub, 'config', 'user.email', 'test@example.com');
  git(sub, 'config', 'user.name', 'Test');
  const pushedSha = commit(sub, 'src/p.ts', 'feat: pushed KIT-T2');
  git(sub, 'push', '-q', 'origin', 'HEAD:main');
  const localSha = commit(sub, 'src/q.ts', 'feat: unpushed KIT-T3');
  const parentSha = commit(parent, 'src/top.ts', 'feat: parent KIT-T4');

  const r = receipt(parent, '--since', '30m');
  assert.equal(r.code, 0, r.err);
  assert.ok(r.out.includes('submodule libs/sub:'), r.out);
  assert.ok(r.out.includes(`${pushedSha.slice(0, 7)} feat: pushed KIT-T2 | KIT-T2 | ${PUSHED}`), r.out);
  assert.ok(r.out.includes(`${localSha.slice(0, 7)} feat: unpushed KIT-T3 | KIT-T3 | ${NOT_PUSHED}`), r.out);
  assert.ok(r.out.includes(`${parentSha.slice(0, 7)} feat: parent KIT-T4 | KIT-T4 | ${LOCAL_ONLY}`), r.out);
});

ok('nothing landed prints one line and exits 0', () => {
  const d = repo();
  const sha = commit(d, 'src/old.ts', 'feat: old KIT-T5');
  const r = receipt(d, '--since', sha);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim().split('\n').length, 1, r.out);
  assert.ok(r.out.startsWith('nothing landed'), r.out);
});

ok('--since a sha excludes that commit and lists the ones after it', () => {
  const d = repo();
  const first = commit(d, 'src/one.ts', 'feat: one KIT-T10');
  const second = commit(d, 'src/two.ts', 'feat: two KIT-T11');
  const r = receipt(d, '--since', first);
  assert.ok(r.out.includes(second.slice(0, 7)) && !r.out.includes('feat: one'), r.out);
});

ok('the default boundary is the landing-alert gate\'s recorded listing when it has one', () => {
  const d = repo();
  const sha = commit(d, 'src/g.ts', 'feat: g KIT-T12');
  const turnStartMs = Date.now() - 60_000;
  writeTurnState(gitRoot(d), { alerted: 'x:local', listed: [sha], turnStartMs, at: Date.now() }, LAND_SLOT);
  const r = receipt(d);
  assert.ok(r.out.includes("the landing-alert's last listing"), r.out);
  assert.ok(r.out.includes(sha.slice(0, 7)), r.out);
});

ok('a recorded listing older than the default window is ignored', () => {
  const d = repo();
  commit(d, 'src/h.ts', 'feat: h KIT-T13');
  const stale = Date.now() - 3 * 60 * 60 * 1000;
  writeTurnState(gitRoot(d), { alerted: 'x:local', listed: ['abc'], turnStartMs: stale, at: stale }, LAND_SLOT);
  assert.ok(receipt(d).out.includes('last 60 minutes by this git user'));
});

ok('a --since that is neither a commit nor a duration exits 2', () => {
  const d = repo();
  commit(d, 'src/i.ts', 'feat: i KIT-T14');
  const r = receipt(d, '--since', 'whenever');
  assert.equal(r.code, 2);
  assert.ok(r.err.includes('neither a commit'), r.err);
});

console.log(`${passed} passed`);
