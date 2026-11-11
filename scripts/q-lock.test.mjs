#!/usr/bin/env node
// Tests for q reads under SQLite lock contention (KIT-T487, KIT-T1042): a stale-cache refresh
// waits briefly for the write lock; a lock held longer never stalls the read, which answers from
// the cache's snapshot with a stderr note. The lock holder is a separate process (a same-process
// holder cannot release while the reader blocks the event loop).

import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { hydrate } from './hydrate-db.mjs';
import { resolveEngine } from './db-engine.mjs';
import { withLockRetry, isLockError, refreshOrServeSnapshot } from './q-lock.mjs';

const Q_CLI = join(dirname(fileURLToPath(import.meta.url)), 'q.mjs');
const HOLD_MS = 300;
const LONG_HOLD_MS = 5000;
const READ_BOUND_MS = 3000;
const GENEROUS_TIMEOUT_MS = 20000;
const FUTURE_MS = 60000;

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

if (!(await resolveEngine())) {
  console.log('q-lock.test: no SQLite engine — skipped');
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), 'kit-qlock-'));
const root = join(tmp, 'proj');
const dbPath = join(tmp, '.cache', 'workflow.db');
const ticketFile = join(root, '.ai', 'tickets', 'LCK-T001-x.md');
mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), 'ids:\n  key: "LCK"\n  pad: 3\n');
writeFileSync(ticketFile, '---\nid: LCK-T001\ntitle: lockword widget\ntype: bug\nstatus: todo\npriority: high\n---\n## Description\nthe lockword widget\n');
const registry = join(tmp, 'registry.json');
writeFileSync(registry, JSON.stringify({ projects: { lck: root } }));
assert.ok((await hydrate({ root, dbPath })).ok, 'fixture hydrates');

const HOLDER = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1]);
db.exec('BEGIN IMMEDIATE');
process.stdout.write('locked\\n');
setTimeout(() => { db.exec('COMMIT'); process.exit(0); }, Number(process.argv[2]));
`;

/** Start a process holding the write lock for holdMs; resolves to { exited } once the lock is taken. */
function holdWriteLock(holdMs) {
  const child = spawn(process.execPath, ['-e', HOLDER, dbPath, String(holdMs)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const exited = new Promise((r) => child.on('exit', r));
  return new Promise((resolve) => child.stdout.once('data', () => resolve({ exited })));
}

/** Make the cache stale so the next q read must rehydrate (a write). */
function makeStale() {
  const future = new Date(Date.now() + FUTURE_MS);
  utimesSync(ticketFile, future, future);
}

function qFts(timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [Q_CLI, '--root', root, 'fts', 'lockword'], {
      env: { ...process.env, CLAUDE_KIT_DB: dbPath, CLAUDE_KIT_REGISTRY: registry, CLAUDE_KIT_Q_SERVER: 'off', CLAUDE_KIT_Q_LOCK_TIMEOUT_MS: String(timeoutMs) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('exit', (status) => resolve({ status, stdout, stderr }));
  });
}

await test('q fts rehydrates and says nothing when the lock clears inside the short refresh wait', async () => {
  makeStale();
  const { exited } = await holdWriteLock(HOLD_MS);
  const r = await qFts(GENEROUS_TIMEOUT_MS);
  await exited;
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /LCK-T001/);
  assert.equal(r.stderr.includes('rehydrating'), false, 'no snapshot note when the refresh ran');
});

await test('q fts on a stale cache returns its snapshot with a note while another session holds the write lock (KIT-T1042)', async () => {
  makeStale();
  const { exited } = await holdWriteLock(LONG_HOLD_MS);
  const started = Date.now();
  const r = await qFts(GENEROUS_TIMEOUT_MS);
  const elapsed = Date.now() - started;
  await exited;
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /LCK-T001/, 'results come back, never an empty answer');
  assert.match(r.stderr, /^q: another session is rehydrating the cache — answered from its last snapshot/);
  assert.ok(elapsed < READ_BOUND_MS, `the read returned in ${elapsed} ms while the lock was held ${LONG_HOLD_MS} ms (bound ${READ_BOUND_MS})`);
});

await test('refreshOrServeSnapshot serves the snapshot on a lock error only when a cache exists', async () => {
  const locked = () => { throw new Error('database is locked'); };
  assert.equal(await refreshOrServeSnapshot(locked, true), true);
  await assert.rejects(refreshOrServeSnapshot(locked, false), /database is locked — another q or session held the store for over/);
  await assert.rejects(refreshOrServeSnapshot(() => { throw new Error('boom'); }, true), /boom/);
  assert.equal(await refreshOrServeSnapshot(() => 'refreshed', true), false);
});

await test('isLockError matches busy/locked errors only', () => {
  assert.ok(isLockError(new Error('database is locked')));
  assert.ok(isLockError({ code: 'SQLITE_BUSY', message: 'x' }));
  assert.ok(!isLockError(new Error('no such table')));
});

await test('withLockRetry retries a lock error then returns', async () => {
  let calls = 0;
  const v = await withLockRetry(() => { if (++calls < 3) throw new Error('database is locked'); return 'ok'; }, GENEROUS_TIMEOUT_MS);
  assert.equal(v, 'ok');
  assert.equal(calls, 3);
});

await test('withLockRetry passes non-lock errors straight through', async () => {
  await assert.rejects(withLockRetry(() => { throw new Error('boom'); }, GENEROUS_TIMEOUT_MS), /boom/);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
