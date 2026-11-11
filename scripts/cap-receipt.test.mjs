#!/usr/bin/env node
// cap-receipt.test.mjs — cap's last line always says whether anything was written, and a held store
// lock never stalls a capture (KIT-T1040). Drives the real CLI in throwaway repos.
// Run: node scripts/cap-receipt.test.mjs

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, reporter } from '../hooks/test-harness.mjs';
import { hydrate } from './hydrate-db.mjs';
import { resolveEngine } from './db-engine.mjs';

const { ok, done } = reporter('cap-receipt');
const CAP = fileURLToPath(new URL('./cap.mjs', import.meta.url));
const CONFIG = 'classifications:\n  bug:     { routes_to: tickets, priority: high, blocking: never }\nids:\n  key: "RCP"\n  prefix: "RCP-T"\n  pad: 3\n';
const DUP_TICKET = '---\nid: RCP-T001\ntitle: plunger launch misfires on slow lanes\ntype: bug\nstatus: todo\npriority: high\n---\n## Description\nplunger launch misfires on slow lanes\n';
const NO_REGISTRY = join(tmpdir(), 'no-registry-for-cap-receipt-test.json');
const FAST_MS = 4000;
const HOLD_MS = 9000;
const LOCK_WAIT_MS = 60000;

const makeRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'kit-cap-receipt-'));
  mkdirSync(join(root, '.ai', 'inbox'), { recursive: true });
  mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), CONFIG);
  writeFileSync(join(root, '.ai', 'tickets', 'RCP-T001-plunger.md'), DUP_TICKET);
  return root;
};

const run = (cwd, args, env = {}) => {
  const r = spawnSync(process.execPath, [CAP, ...args], {
    cwd, encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_REGISTRY: NO_REGISTRY, CLAUDE_KIT_BUG_STORE: 'off', ...env },
  });
  const lines = (s) => s.split('\n').filter(Boolean);
  return { status: r.status, out: lines(r.stdout), err: lines(r.stderr) };
};

try {
  const repo = makeRepo();

  const dup = run(repo, ['bug', 'plunger launch misfires on slow lanes again']);
  ok('a capture with a possible duplicate lists it, then ends on the captured line',
    dup.status === 0 && dup.out.some((l) => /RCP-T001/.test(l)) && /^captured \(bug\) ->/.test(dup.out.at(-1)));
  ok('the duplicate list is never the last line', !/possible duplicate|RCP-T001/.test(dup.out.at(-1)));

  const kitStore = makeRepo();
  const kit = run(kitStore, ['bug', 'plunger launch misfires on slow lanes once more'], { CLAUDE_KIT_BUG_STORE: kitStore });
  ok('a kit ticket with a possible duplicate ends on the filed line',
    kit.status === 0 && kit.out.some((l) => /RCP-T001/.test(l)) && /^filed RCP-T\d+ \(kit-bug\)/.test(kit.out.at(-1)));

  const noTarget = run(repo, ['--project', 'nowhere', 'bug', 'x']);
  ok('an unknown --project ends on a refusal that says nothing was written',
    noTarget.status === 1 && /^cap: refused, nothing was written: .*nowhere/.test(noTarget.err.at(-1)));

  const empty = run(repo, []);
  ok('no arguments end on a refusal that says nothing was written',
    empty.status === 1 && /^cap: refused, nothing was written:/.test(empty.err.at(-1)));

  const noInbox = mkdtempSync(join(tmpdir(), 'kit-cap-receipt-'));
  mkdirSync(join(noInbox, '.ai'), { recursive: true });
  writeFileSync(join(noInbox, '.ai', 'config.yml'), CONFIG);
  writeFileSync(join(noInbox, '.ai', 'inbox'), 'a file where the inbox directory belongs');
  const crash = run(noInbox, ['bug', 'a capture the store cannot take']);
  ok('an unexpected write error ends on a failure line, not a stack trace',
    crash.status === 1 && /^cap: failed, nothing confirmed written:/.test(crash.err.at(-1)));

  if (await resolveEngine()) {
    const lockRepo = makeRepo();
    const dbPath = join(lockRepo, 'workflow.db');
    const registry = join(lockRepo, 'registry.json');
    writeFileSync(registry, JSON.stringify({ projects: { rcp: lockRepo } }));
    await hydrate({ root: lockRepo, dbPath });
    writeFileSync(join(lockRepo, '.ai', 'tickets', 'RCP-T002-newer.md'), DUP_TICKET.replace('RCP-T001', 'RCP-T002'));
    const holder = spawn(process.execPath, ['-e',
      "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.argv[1]); db.exec('BEGIN IMMEDIATE'); process.stdout.write('locked\\n'); setTimeout(() => process.exit(0), Number(process.argv[2]));",
      dbPath, String(HOLD_MS)], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve) => holder.stdout.once('data', resolve));
    const started = Date.now();
    const held = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CAP, 'bug', 'plunger launch misfires on slow lanes while locked'], {
        cwd: lockRepo, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_KIT_REGISTRY: registry, CLAUDE_KIT_BUG_STORE: 'off', CLAUDE_KIT_DB: dbPath, CLAUDE_KIT_Q_LOCK_TIMEOUT_MS: String(LOCK_WAIT_MS) },
      });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.on('exit', (status) => resolve({ status, out: out.split('\n').filter(Boolean) }));
    });
    const elapsed = Date.now() - started;
    holder.kill();
    ok(`a capture finishes in under ${FAST_MS} ms while another process holds the store write lock (${elapsed} ms)`,
      held.status === 0 && elapsed < FAST_MS && /^captured/.test(held.out.at(-1)));
    ok('and still lists the duplicates it found without the cache', held.out.some((l) => /RCP-T001/.test(l)));
  }
} finally { cleanup(); }
done();
