#!/usr/bin/env node
// Guarantee test: an id is NEVER minted below what is already on disk, and a create path
// NEVER writes over an id that exists (KIT-T166).
//
// The lived failure: gridiron-blitz triage re-minted GB-T001..T005 on top of the existing
// GB-T001..T006 — five duplicate-id ticket files sat on the board for three weeks while INDEX
// showed only one set. Both allocators (next-id.mjs's O(1) cache query and triage --apply's
// MAX(num) over the held handle) derived the counter from the CACHE alone. A cache that is
// stale — clobbered, never hydrated, or carrying another machine's mtimes across the shared
// data repo — therefore hands back an id whose file already exists.
//
// Method: hydrate a cache that knows ONE ticket, then put five more on disk and date the db
// FORWARD so the staleness self-heal is defeated (this is exactly the cross-machine mtime skew
// the ticket suspects). The allocators must still answer from the max on DISK.
//
// TEST ISOLATION (KIT-T142/KIT-T164): synthetic id key (TST), a temp dbPath via a redirected
// CLAUDE_PLUGIN_ROOT, and a temp CLAUDE_KIT_REGISTRY — never the real cache or registry.

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolveEngine } from './db-engine.mjs';

const HERE = join(fileURLToPath(import.meta.url), '..');
const NEXT_ID = join(HERE, 'next-id.mjs');
const HYDRATE = join(HERE, 'hydrate-db.mjs');
const T = join(HERE, 't.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

const CONFIG = `classifications:
  bug: { routes_to: tickets, priority: high, blocking: never }
statuses:
  flow: [todo, doing, review, done]
ids:
  key: "TST"
  pad: 3
`;
const TEMPLATE = `---\nid: TST-T000\ntitle: <short imperative title>\ntype: bug\nstatus: todo\npriority: medium\nlinks: []\n---\n\n## Description\n<what and why>\n\n## Notes\n`;
const ticket = (id) => `---\nid: ${id}\ntitle: seeded ${id}\ntype: bug\nstatus: todo\npriority: high\n---\n\n## Description\nseeded ${id}\n`;

// An adopted project registered on a throwaway registry, with its OWN cache under .cache/.
function makeProject(label, ids) {
  const root = mkdtempSync(join(tmpdir(), `kit-idcol-${label}-`));
  fixtures.push(root);
  mkdirSync(join(root, '.ai', 'tickets', 'archive'), { recursive: true });
  mkdirSync(join(root, '.ai', 'inbox'), { recursive: true });
  mkdirSync(join(root, '.cache'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), CONFIG);
  writeFileSync(join(root, '.ai', 'tickets', '_TEMPLATE.md'), TEMPLATE);
  for (const id of ids) writeFileSync(join(root, '.ai', 'tickets', `${id}-seed.md`), ticket(id));
  const regPath = join(root, 'projects.json');
  writeFileSync(regPath, JSON.stringify({ projects: { [`fixture-${label}`]: root } }));
  return { root, regPath, db: join(root, '.cache', 'workflow.db') };
}

const env = (p) => ({ ...process.env, CLAUDE_KIT_REGISTRY: p.regPath, CLAUDE_PLUGIN_ROOT: p.root });

// Freeze the cache: hydrate what exists now, then date the db an hour into the future so the
// mtime staleness check treats it as current no matter what lands on disk afterwards.
const HOUR_S = 3600;
function freezeCache(p) {
  execFileSync(process.execPath, [HYDRATE, '--root', p.root], { env: env(p), stdio: ['ignore', 'pipe', 'pipe'] });
  const future = new Date(Date.now() + HOUR_S * 1000);
  utimesSync(p.db, future, future);
}

const engine = await resolveEngine();
if (!engine) {
  console.log('  skip  (no SQLite engine — the stale-cache scenarios need one)');
  console.log('\nid-collision: 0 passed, 0 failed (skipped — no engine)');
  process.exit(0);
}

// ---- next-id.mjs: the cache must never lower the counter --------------------
console.log('\n[next-id] a stale cache must not mint below the on-disk max');
{
  const p = makeProject('nextid', ['TST-T001']);
  freezeCache(p);
  ok('cache seeded with exactly one ticket', existsSync(p.db));

  // Five more tickets land on disk that the frozen cache knows nothing about.
  for (const id of ['TST-T002', 'TST-T003', 'TST-T004', 'TST-T005', 'TST-T006']) {
    writeFileSync(join(p.root, '.ai', 'tickets', `${id}-seed.md`), ticket(id));
  }

  const out = execFileSync(process.execPath, [NEXT_ID, 'tickets', p.root], {
    env: env(p), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  ok('next-id mints ABOVE the highest id on disk (TST-T007)', out === 'TST-T007', `got ${out}`);
  ok('next-id does not hand back an id whose file already exists',
    !existsSync(join(p.root, '.ai', 'tickets', `${out}-seed.md`)), out);
}

// ---- t new: mints above the on-disk max and never overwrites ----------------
console.log('\n[t new] scaffolds above the on-disk max');
{
  const p = makeProject('tnew', ['TST-T001', 'TST-T002', 'TST-T003']);
  freezeCache(p);
  writeFileSync(join(p.root, '.ai', 'tickets', 'TST-T004-seed.md'), ticket('TST-T004'));
  const before = readFileSync(join(p.root, '.ai', 'tickets', 'TST-T004-seed.md'), 'utf8');

  const out = execFileSync(process.execPath, [T, 'new', 'bug', 'a brand new ticket'], {
    cwd: p.root, env: env(p), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  ok('t new mints TST-T005, above the newest file on disk', /TST-T005/.test(out), out.trim());
  ok('the pre-existing TST-T004 file is untouched',
    readFileSync(join(p.root, '.ai', 'tickets', 'TST-T004-seed.md'), 'utf8') === before);
}

// ---- triage --apply's allocator ---------------------------------------------
// mintId is the exact function the --apply batch uses. Driven here with a db handle that
// reports a STALE max (the clobbered/never-hydrated cache) against a store dir that holds
// higher ids — the precise shape of the gridiron re-mint.
console.log('\n[triage mintId] batch allocator answers from disk, not just the handle');
{
  const { mintId } = await import('./triage/apply.mjs');
  const p = makeProject('mint', ['TST-T001', 'TST-T002', 'TST-T003', 'TST-T004', 'TST-T005']);
  const staleDb = { all: () => [{ m: 1 }] }; // the cache believes only TST-T001 exists
  const aiDir = join(p.root, '.ai');

  const first = mintId(staleDb, 'TST', 'tickets', p.root, new Map(), aiDir);
  ok('mintId skips past every id on disk (TST-T006)', first === 'TST-T006', `got ${first}`);

  // Batch-local high-water mark still applies within one run (KIT-T009).
  const alloc = new Map();
  const a = mintId(staleDb, 'TST', 'tickets', p.root, alloc, aiDir);
  const b = mintId(staleDb, 'TST', 'tickets', p.root, alloc, aiDir);
  ok('sequential creates in one batch stay sequential', a === 'TST-T006' && b === 'TST-T007', `${a}, ${b}`);
}

// ---- the create path REFUSES a taken id -------------------------------------
// The backstop behind the allocator: even handed a colliding id, the writer must not
// last-writer-wins over an existing file.
console.log('\n[writeFromTemplate] refuses to write over an existing id');
{
  const { writeFromTemplate } = await import('./triage/write-item.mjs');
  const p = makeProject('refuse', ['TST-T001', 'TST-T002']);
  const aiDir = join(p.root, '.ai');
  const victim = join(aiDir, 'tickets', 'TST-T002-seed.md');
  const before = readFileSync(victim, 'utf8');

  let err = null;
  try {
    writeFromTemplate({ aiDir, store: 'tickets', id: 'TST-T002', type: 'bug', status: 'todo',
      priority: 'high', title: 'a colliding create', links: [], text: 'would have clobbered TST-T002' });
  } catch (e) { err = e; }

  ok('writeFromTemplate throws on a taken id', !!err, err ? '' : 'no error thrown');
  ok('the error names the colliding id', !!err && /TST-T002/.test(err.message), err && err.message);
  ok('the existing file is byte-identical afterwards', readFileSync(victim, 'utf8') === before);

  // A free id still writes normally — the guard must not block legitimate creates.
  const rel = writeFromTemplate({ aiDir, store: 'tickets', id: 'TST-T003', type: 'bug', status: 'todo',
    priority: 'high', title: 'a fresh create', links: [], text: 'fresh' });
  ok('a free id still writes', existsSync(join(aiDir, rel)), rel);
}

for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}
console.log(`\nid-collision: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
