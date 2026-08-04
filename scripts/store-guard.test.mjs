#!/usr/bin/env node
// Guarantee test: an UNREGISTERED .ai store can never rewrite a live scope in the SHARED
// cache (KIT-T164). The measured failure: one Edit to a scratchpad fixture whose config
// declared `ids.key: KIT` took the live KIT scope from 56 open items to 1 — hydrate replaces
// every row for the scope a store DECLARES, and any directory on disk can declare any key.
//
// Method: build two stores that BOTH claim the scope key `REGD` — one registered in a temp
// project registry, one a rogue temp dir — point CLAUDE_PLUGIN_ROOT at a throwaway install so
// defaultDbPath() is a temp "shared" DB, then mutate through writeItemFile (the exact caller
// from the incident) and count the scope's rows. The registered root must still hydrate; the
// rogue root must leave the shared DB untouched while its FILE still lands (fail-open write,
// cache side-effect only).
//
// TEST ISOLATION (KIT-T142): synthetic id keys, a temp dbPath, CLAUDE_PLUGIN_ROOT and
// CLAUDE_KIT_REGISTRY both redirected — this suite never reads or writes the real cache.

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveEngine } from './db-engine.mjs';

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

const engine = await resolveEngine();
if (!engine) {
  console.log('  skip  (no SQLite engine — the cache is optional; the store guard needs one)');
  console.log('\nstore-guard: 0 passed, 0 failed (skipped — no engine)');
  process.exit(0);
}

const CONFIG = (key) => `classifications:
  bug: { routes_to: tickets, priority: high, blocking: never }
statuses:
  flow: [todo, doing, review, done]
ids:
  key: "${key}"
  pad: 3
`;

const ticket = (id, title) =>
  `---\nid: ${id}\ntitle: ${title}\ntype: bug\nstatus: todo\npriority: high\n---\n\n## Description\n${title}\n`;

// A store that claims scope `REGD`. `ids` seeds its tickets dir.
function makeStore(label, ids) {
  const root = mkdtempSync(join(tmpdir(), `kit-storeguard-${label}-`));
  fixtures.push(root);
  mkdirSync(join(root, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), CONFIG('REGD'));
  for (const id of ids) writeFileSync(join(root, '.ai', 'tickets', `${id}-seed.md`), ticket(id, `seeded ${id}`));
  return root;
}

// The throwaway "install" whose .cache/workflow.db stands in for the shared cache.
const world = mkdtempSync(join(tmpdir(), 'kit-storeguard-world-'));
fixtures.push(world);
mkdirSync(join(world, '.cache'), { recursive: true });

const registered = makeStore('registered', ['REGD-T001', 'REGD-T002', 'REGD-T003']);
const rogue = makeStore('rogue', ['REGD-T001']);

const regPath = join(world, 'projects.json');
writeFileSync(regPath, JSON.stringify({ projects: { 'registered-fixture': registered } }, null, 2));

// Both resolved at CALL time inside the modules under test, so setting them here is enough.
process.env.CLAUDE_KIT_REGISTRY = regPath;
process.env.CLAUDE_PLUGIN_ROOT = world;

const { hydrate, defaultDbPath } = await import('./hydrate-db.mjs');
const { writeItemFile } = await import('../hooks/lib.mjs');

const sharedDb = defaultDbPath();
ok('defaultDbPath is redirected into the throwaway install', sharedDb.startsWith(world), sharedDb);

async function scopeRows() {
  const open = await resolveEngine();
  const db = open(sharedDb);
  try {
    return db.all("SELECT id FROM items WHERE scope = 'REGD' ORDER BY id").map((r) => r.id);
  } finally {
    db.close();
  }
}

// Capture stderr for the one call under test — the guard must SAY it skipped, never fail silent.
async function captureStderr(fn) {
  const orig = process.stderr.write.bind(process.stderr);
  let buf = '';
  process.stderr.write = (chunk, ...rest) => { buf += String(chunk); return orig(chunk, ...rest); };
  try { return { out: await fn(), err: buf }; } finally { process.stderr.write = orig; }
}

// ---- seed: the REGISTERED store hydrates into the shared cache normally ------
await hydrate({ root: registered });
const seeded = await scopeRows();
ok('registered store hydrates: 3 REGD rows in the shared cache', seeded.length === 3, seeded.join(','));

// ---- the defect: one writeItemFile into an UNREGISTERED store ---------------
const rogueFile = join(rogue, '.ai', 'tickets', 'REGD-T001-rogue.md');
const { err: rogueErr } = await captureStderr(() => writeItemFile(rogueFile, ticket('REGD-T001', 'rogue edit')));

const afterRogue = await scopeRows();
ok('UNREGISTERED store edit does NOT clobber the live scope (still 3 rows)',
  afterRogue.length === 3, `rows now: ${afterRogue.join(',') || '(none)'}`);
ok('the rogue FILE still landed on disk (write fails open; only the cache side-effect is skipped)',
  existsSync(rogueFile));
ok('the skip is announced on stderr, never silent', /not a registered project/i.test(rogueErr), rogueErr.trim());

// hydrate() reports the refusal as data, so callers can branch on it.
const direct = await hydrate({ root: rogue });
ok('hydrate() returns {ok:false, reason:"unregistered-root"} for an unregistered root',
  direct && direct.ok === false && direct.reason === 'unregistered-root', JSON.stringify(direct));

// ---- the registered root must STILL hydrate at the write site ---------------
await writeItemFile(join(registered, '.ai', 'tickets', 'REGD-T004-new.md'), ticket('REGD-T004', 'a fresh registered item'));
const afterRegistered = await scopeRows();
ok('registered store still hydrates at the write site (4 rows)', afterRegistered.length === 4, afterRegistered.join(','));
ok('the new registered item is queryable immediately', afterRegistered.includes('REGD-T004'));

// ---- an isolated, caller-owned DB is never gated ---------------------------
// The guard protects the SHARED cache only: a test/tool that names its own --db still hydrates
// any store it likes (this is the pattern every other suite here uses).
const privateDb = join(world, 'private.db');
const privateRun = await hydrate({ root: rogue, dbPath: privateDb });
ok('an explicit non-default dbPath hydrates an unregistered store freely',
  privateRun && privateRun.ok === true && existsSync(privateDb), JSON.stringify(privateRun));

// ---- the repair tool keeps its escape hatch --------------------------------
const forced = await hydrate({ root: rogue, allowUnregistered: true });
ok('allowUnregistered:true still lets the repair tool hydrate deliberately',
  forced && forced.ok === true, JSON.stringify(forced));

for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}
console.log(`\nstore-guard: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
