#!/usr/bin/env node
// Tests for begin-task.mjs + end-task.mjs (KIT-T029). Builds throwaway .ai fixtures in
// a temp dir and shells the real CLIs — these are integration tests, not unit tests,
// because the value is the CLI surface: correct exit codes, shape of JSON output,
// graceful failure on a missing id, and the status+note roundtrip. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BEGIN = resolve(SCRIPT_DIR, 'begin-task.mjs');
const END = resolve(SCRIPT_DIR, 'end-task.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

// KIT-T142: begin/end-task refresh the cache at defaultDbPath(), which resolves under
// CLAUDE_PLUGIN_ROOT and is inherited by run()'s children. The fixture config declares a real
// project key, so without the redirect this suite REPLACES that scope in the live cache.
const PLUGIN_ROOT = mkdtempSync(join(tmpdir(), 'kit-begin-plugin-'));
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT;
fixtures.push(PLUGIN_ROOT);

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// Run a script, returning { stdout, stderr, status }. Never throws.
function run(script, args, opts = {}) {
  const r = spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...opts.env },
  });
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status ?? 1 };
}

// ---- fixture helpers --------------------------------------------------------------------

const CONFIG = `classifications:
  feature: { routes_to: backlog }
  bug:     { routes_to: tickets }
statuses:
  flow: [todo, doing, review, done]
  human_only: []
  off_board: [superseded]
uat:
  default: none
history:
  archive_done_to: tickets/archive
ids:
  key: "KIT"
  prefix: "KIT-T"
  pad: 3
`;

function ticketDoc(id, { type = 'feature', status = 'todo', links = '' } = {}) {
  return `---
id: ${id}
title: Test ticket ${id}
type: ${type}
status: ${status}
priority: high
${links ? `links: [${links}]\n` : 'links: []\n'}supersedes:
superseded_by:
---

## Description
A seeded test ticket for begin-task / end-task integration tests.

## Acceptance Criteria
- [ ] first open criterion
- [x] already satisfied criterion
- [ ] second open criterion

## Notes
Some notes text from prior sessions.

## History
- [2026-01-01 00:00] (created) feature — Test ticket ${id}
`;
}

function project(tickets = {}) {
  const d = mkdtempSync(join(tmpdir(), 'kit-bt-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), CONFIG);
  for (const [id, opts] of Object.entries(tickets)) {
    writeFileSync(join(d, '.ai', 'tickets', `${id}-seed.md`), ticketDoc(id, opts));
  }
  return d;
}

// ---- begin-task: JSON shape -----------------------------------------------------------

const bt1 = project({ 'KIT-T001': {} });
const r1 = run(BEGIN, ['KIT-T001', '--root', bt1]);
ok('begin-task: exits 0', r1.status === 0);

let packet;
try { packet = JSON.parse(r1.stdout); } catch { packet = null; }
ok('begin-task: emits valid JSON by default', packet !== null);
ok('begin-task: packet.id matches', packet && packet.id === 'KIT-T001');
ok('begin-task: packet.meta.title present', packet && typeof packet.meta.title === 'string' && packet.meta.title.length > 0);
ok('begin-task: packet.meta.status present', packet && typeof packet.meta.status === 'string');
ok('begin-task: packet.description present', packet && typeof packet.description === 'string');
ok('begin-task: packet.criteria is an array', packet && Array.isArray(packet.criteria));
ok('begin-task: only OPEN criteria included (2 open, 1 checked)', packet && packet.criteria.length === 2);
ok('begin-task: checked criterion excluded', packet && !packet.criteria.some((c) => /already satisfied/.test(c)));
ok('begin-task: packet.notes present', packet && typeof packet.notes === 'string');
ok('begin-task: packet.trail is an array', packet && Array.isArray(packet.trail));
ok('begin-task: packet.history is an array', packet && Array.isArray(packet.history));

// ---- begin-task: --md output -----------------------------------------------------------

const r1md = run(BEGIN, ['KIT-T001', '--md', '--root', bt1]);
ok('begin-task --md: exits 0', r1md.status === 0);
ok('begin-task --md: emits markdown heading', /^#\s+Handoff brief:/m.test(r1md.stdout));
ok('begin-task --md: includes acceptance criteria section', /## Open Acceptance Criteria/.test(r1md.stdout));
ok('begin-task --md: includes open criteria lines', /- \[ \] first open criterion/.test(r1md.stdout));
ok('begin-task --md: excludes checked criteria', !/already satisfied/.test(r1md.stdout));
ok('begin-task --md: is NOT valid JSON (is markdown)', (() => { try { JSON.parse(r1md.stdout); return false; } catch { return true; } })());

// ---- KIT-T048: the brief shows the AUTHORED summary, not a clipped title ----------------

// A private scope key ("BTX"): the kit's OWN .ai is always a hydration source, so a fixture
// reusing the real "KIT" key would be answered from the kit's rows, not its own.
const bt2 = mkdtempSync(join(tmpdir(), 'kit-bt2-'));
fixtures.push(bt2);
mkdirSync(join(bt2, '.ai', 'tickets'), { recursive: true });
mkdirSync(join(bt2, '.ai', 'decisions'), { recursive: true });
writeFileSync(join(bt2, '.ai', 'config.yml'), CONFIG.replace(/"KIT"/, '"BTX"').replace('KIT-T', 'BTX-T'));
writeFileSync(join(bt2, '.ai', 'tickets', 'BTX-T002-seed.md'),
  '---\nid: BTX-T002\ntitle: summary-bearing trail\ntype: feature\nstatus: todo\npriority: high\n'
  + 'links: [BTX-D001, BTX-D002]\n---\n\n## Description\nx\n\n## History\n');
writeFileSync(join(bt2, '.ai', 'decisions', 'BTX-D001.md'),
  '---\nid: BTX-D001\ntitle: A very long decision headline that would be clipped mid-word by the trail renderer for sure\n'
  + 'summary: writes go back through markdown, which stays the only truth\ndate: 2026-08-15\n---\n**Decision:** as summarized.\n');
// Negative control: no summary — this one must still fall back to its title.
writeFileSync(join(bt2, '.ai', 'decisions', 'BTX-D002.md'),
  '---\nid: BTX-D002\ntitle: the untouched decision\ndate: 2026-08-15\n---\n**Decision:** unchanged.\n');
// The fixture must be a REGISTERED store to hydrate into the sandboxed cache (KIT-T164).
const BT2_REG = join(PLUGIN_ROOT, 'bt2-projects.json');
writeFileSync(BT2_REG, JSON.stringify({ projects: { 'bt2-fixture': bt2 } }));
const BT2_ENV = { env: { CLAUDE_KIT_REGISTRY: BT2_REG } };
const r2 = run(BEGIN, ['BTX-T002', '--root', bt2], BT2_ENV);
let packet2;
try { packet2 = JSON.parse(r2.stdout); } catch { packet2 = null; }
const trailRow = packet2 && packet2.trail.find((t) => t.id === 'BTX-D001');
ok('begin-task: a linked decision surfaces with its authored summary',
  !!trailRow && trailRow.summary === 'writes go back through markdown, which stays the only truth');
ok('begin-task: a decision with no summary still falls back to its title',
  packet2 && packet2.trail.find((t) => t.id === 'BTX-D002').summary === 'the untouched decision');
ok('begin-task --md: the governing block prints the summary, not the long title',
  /writes go back through markdown/.test(run(BEGIN, ['BTX-T002', '--md', '--root', bt2], BT2_ENV).stdout));

// ---- begin-task: fail-open on unknown id -----------------------------------------------

const r1bad = run(BEGIN, ['KIT-T999', '--root', bt1]);
ok('begin-task: exits non-zero on unknown id', r1bad.status !== 0);
ok('begin-task: error message mentions the id', /KIT-T999/.test(r1bad.stderr));

// ---- begin-task: missing id argument ---------------------------------------------------

const r1noarg = run(BEGIN, ['--root', bt1]);
ok('begin-task: exits non-zero with no id arg', r1noarg.status !== 0);

// ---- end-task: status transition -------------------------------------------------------

const et1 = project({ 'KIT-T010': { status: 'todo' } });
const re1 = run(END, ['KIT-T010', 'doing', '--root', et1]);
ok('end-task: exits 0 on valid transition', re1.status === 0);

// Read the file back to verify the transition actually happened.
const ticketText = readFileSync(join(et1, '.ai', 'tickets', 'KIT-T010-seed.md'), 'utf8');
ok('end-task: status updated in file', /status: doing/.test(ticketText));
ok('end-task: History line appended', /\(status\) todo → doing/.test(ticketText));

// ---- end-task: --note appends a History comment ----------------------------------------

const et2 = project({ 'KIT-T020': { status: 'todo' } });
const re2 = run(END, ['KIT-T020', 'doing', '--note', 'handoff context assembled', '--root', et2]);
ok('end-task: exits 0 with --note', re2.status === 0);

const noteText = readFileSync(join(et2, '.ai', 'tickets', 'KIT-T020-seed.md'), 'utf8');
ok('end-task: --note appended under History', /\(comment\) handoff context assembled/.test(noteText));

// ---- end-task: fail on unknown id -------------------------------------------------------

const et3 = project({ 'KIT-T030': {} });
const re3 = run(END, ['KIT-T999', 'doing', '--root', et3]);
ok('end-task: exits non-zero on unknown id', re3.status !== 0);

// ---- end-task: fail on missing args -----------------------------------------------------

const re4 = run(END, ['KIT-T030', '--root', et3]);
ok('end-task: exits non-zero when status arg missing', re4.status !== 0);

// ---- begin-task: GOVERNING DECISIONS block (KIT-T232) -----------------------------------

function decisionDoc(id, title, paths, body) {
  return `---
id: ${id}
title: ${title}
status: accepted
paths: ${paths}
---

${body}
`;
}

// A ticket that declares `files:`, plus one decision that PARKS that area and one that
// governs an unrelated area (the negative control).
function governedProject() {
  const d = project({});
  mkdirSync(join(d, '.ai', 'decisions'), { recursive: true });
  writeFileSync(join(d, '.ai', 'tickets', 'KIT-T500-seed.md'), `---
id: KIT-T500
title: legacy2d suite not green
type: bug
status: todo
priority: high
files: [src/legacy2d]
links: []
---

## Description
The legacy2d suite is red on main.

## Acceptance Criteria
- [ ] make it green
`);
  writeFileSync(join(d, '.ai', 'decisions', 'KIT-D900-park.md'),
    decisionDoc('KIT-D900', 'The 2D build is parked', 'src/legacy2d/*', 'The 2D build is PARKED indefinitely; do not spend on its suite.'));
  writeFileSync(join(d, '.ai', 'decisions', 'KIT-D901-other.md'),
    decisionDoc('KIT-D901', 'Renderer uses one pipeline', 'src/render3d/*', 'All rendering goes through a single pipeline.'));
  return d;
}

const gp = governedProject();
const rg = run(BEGIN, ['KIT-T500', '--root', gp]);
let gpacket;
try { gpacket = JSON.parse(rg.stdout); } catch { gpacket = null; }
ok('begin-task: packet.governing is an array', gpacket && Array.isArray(gpacket.governing));
const govIds = gpacket ? gpacket.governing.map((g) => g.id) : [];
ok('begin-task: governing includes the decision covering the ticket files', govIds.includes('KIT-D900'));
ok('begin-task: governing EXCLUDES a decision for an unrelated area', !govIds.includes('KIT-D901'));
const parkRow = gpacket && gpacket.governing.find((g) => g.id === 'KIT-D900');
ok('begin-task: the parking decision is flagged parked', !!parkRow && parkRow.parked === true);

const rgMd = run(BEGIN, ['KIT-T500', '--md', '--root', gp]);
ok('begin-task --md: emits the GOVERNING DECISIONS block', /## GOVERNING DECISIONS — read before dispatch/.test(rgMd.stdout));
ok('begin-task --md: flags the parked decision', /!! PARKED\? \*\*KIT-D900\*\*/.test(rgMd.stdout));

// Negative control: a ticket with no governing decision states so explicitly.
const ug = project({ 'KIT-T501': {} });
const rug = run(BEGIN, ['KIT-T501', '--md', '--root', ug]);
ok('begin-task --md: block present with "none" when nothing governs', /## GOVERNING DECISIONS[\s\S]*none govern/.test(rug.stdout));
ok('begin-task --md: no PARKED flag when nothing is parked', !/PARKED\?/.test(rug.stdout));

// ---- cleanup + result ----------------------------------------------------------------

for (const d of fixtures) {
  try { execFileSync('node', ['-e', `require('fs').rmSync(${JSON.stringify(d)}, {recursive:true,force:true})`]); } catch { /* best-effort */ }
}

console.log('');
console.log(`begin-task / end-task: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
