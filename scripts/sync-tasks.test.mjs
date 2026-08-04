#!/usr/bin/env node
// Tests for sync-tasks.mjs — the native-task spec /work hydrates from (KIT-T169, superseding
// KIT-T120). Every defect here was MEASURED against gridiron-blitz on 2026-08-02, where the
// spec came back with ~76 tasks that were mostly garbage:
//   (1) the id came from the FILENAME, so a slug carrying digits
//       (`GB-T011-playcall-single-row-change-v23-regressed-the-2-r.md`) became ticket "the-2";
//   (2) INDEX.md and _TEMPLATE.md were read as tickets ("INDEX Ticket board");
//   (3) an EMPTY acceptance checklist let the whole-file checkbox scan run past the section —
//       `- [ ]\n\n## Plan` matched as ONE criterion whose text was "## Plan";
//   (4) status was parsed locally and disagreed with index-tickets.mjs, so every ticket read
//       `todo` — and the spec ignored the hydrate contract (active = `doing`) entirely.
//
// ISOLATION (KIT-T142/T164): a synthetic ids.key (SYT) in a throwaway temp root, and the CLI
// child runs with CLAUDE_PLUGIN_ROOT redirected. sync-tasks is read-only — it opens no cache
// and writes nothing — so the live KIT scope is untouched by construction.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { taskSpec } from './sync-tasks.mjs';

const SCRIPT = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, '.mjs');
let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

const PLUGIN_ROOT = mkdtempSync(join(tmpdir(), 'kit-sync-plugin-'));
const root = mkdtempSync(join(tmpdir(), 'kit-sync-'));
const ticketsDir = join(root, '.ai', 'tickets');
mkdirSync(join(ticketsDir, 'archive'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), `native_task_sync:
  enabled: true
  status_map:
    todo: pending
    doing: in_progress
    review: completed
    done: completed
ids:
  key: "SYT"
  prefix: "SYT-T"
  pad: 3
`);

const ticket = (id, { status = 'todo', title = `seed ${id}`, criteria = '- [ ] first\n- [x] second' } = {}) =>
  `---\nid: ${id}\ntitle: ${title}\ntype: bug\nstatus: ${status}\npriority: high\nlinks: []\n---\n\n` +
  `## Description\nseed.\n\n## Acceptance Criteria\n${criteria}\n\n## Plan\n1. a plan step\n- [ ] a plan checkbox\n\n## History\n`;

// (1) the digit-slug repro, written CRLF — the exact shape whose frontmatter the old LF-only
// block regex missed, sending the id to the filename fallback and minting "the-2".
writeFileSync(join(ticketsDir, 'SYT-T011-playcall-single-row-change-v23-regressed-the-2-r.md'),
  ticket('SYT-T011', { status: 'doing', title: 'playcall single row change' }).replace(/\n/g, '\r\n'));
// (3) an EMPTY acceptance checklist directly above `## Plan`.
writeFileSync(join(ticketsDir, 'SYT-T003-empty-criteria.md'),
  ticket('SYT-T003', { status: 'doing', title: 'nothing checkable yet', criteria: '- [ ]' }));
// (4) statuses the old parse flattened to `todo`.
writeFileSync(join(ticketsDir, 'SYT-T001-review.md'), ticket('SYT-T001', { status: 'review' }));
writeFileSync(join(ticketsDir, 'SYT-T002-todo.md'), ticket('SYT-T002', { status: 'todo' }));
// A status carrying the template's trailing YAML comment — comment-blind parsing read the
// whole `doing   # todo | doing | …` string as the status and matched nothing.
writeFileSync(join(ticketsDir, 'SYT-T004-commented.md'),
  ticket('SYT-T004', { status: 'doing', title: 'commented status' })
    .replace('status: doing', 'status: doing           # todo | doing | review | done'));
// (2) generated / template files that are NOT tickets, plus an id-less stray note.
writeFileSync(join(ticketsDir, 'INDEX.md'), '# Ticket board\n\n| id | type |\n| --- | --- |\n| SYT-T001 | bug |\n');
writeFileSync(join(ticketsDir, '_TEMPLATE.md'), ticket('SYT-T000', { status: 'doing', title: '<short imperative title>' }));
writeFileSync(join(ticketsDir, 'notes-to-self.md'), '# scratch\n\n- [ ] not a ticket at all\n');
// Archived tickets live in a subdir — the scan must not descend into it.
writeFileSync(join(ticketsDir, 'archive', 'SYT-T009-done.md'), ticket('SYT-T009', { status: 'done' }));

const spec = taskSpec(root);
const all = taskSpec(root, { all: true });
const subjects = spec.tasks.map((t) => t.subject);
const ticketsIn = (s) => [...new Set(s.tasks.map((t) => t.ticket))].sort();

// --- (1) the id is the FRONTMATTER id, never scraped off a digit-bearing slug ---
ok('id: a digit-bearing slug never mints a phantom ticket id ("the-2")',
  !spec.tasks.some((t) => /the-2|v23/.test(t.ticket)));
ok('id: the CRLF digit-slug ticket is emitted under its frontmatter id',
  spec.tasks.some((t) => t.ticket === 'SYT-T011'));
ok('id: every emitted ticket id is <KEY>-<TYPE><NUM>-shaped',
  spec.tasks.every((t) => /^SYT-T\d+$/.test(t.ticket)));

// --- (2) generated / template / id-less files are not tickets ---
ok('skip: INDEX.md contributes no task', !subjects.some((s) => /INDEX|Ticket board/.test(s)));
ok('skip: _TEMPLATE.md contributes no task', !ticketsIn(all).includes('SYT-T000'));
ok('skip: a .md with no frontmatter id contributes no task',
  !subjects.some((s) => /not a ticket at all|notes-to-self/.test(s)));
ok('skip: archive/ is not scanned', !ticketsIn(all).includes('SYT-T009'));

// --- (3) an empty acceptance checklist emits no phantom "## Plan" task ---
const t003 = spec.tasks.filter((t) => t.ticket === 'SYT-T003');
ok('empty criteria: no task is scraped from the heading that follows the checklist',
  !subjects.some((s) => /## Plan|Plan$/.test(s)));
ok('empty criteria: the ticket falls back to exactly ONE title task',
  t003.length === 1 && t003[0].subject === 'SYT-T003 nothing checkable yet');
ok('scope: a `- [ ]` under ## Plan is never a criterion',
  !subjects.some((s) => /a plan checkbox/.test(s)));

// --- (4) status is honored, and only ACTIVE (doing) tickets hydrate ---
ok('status: only `doing` tickets are emitted (the hydrate contract)',
  ticketsIn(spec).join() === 'SYT-T003,SYT-T004,SYT-T011');
ok('status: an inline YAML comment on `status:` does not hide the ticket',
  ticketsIn(spec).includes('SYT-T004'));
ok('status: ticketStatus reflects the frontmatter, not a flattened "todo"',
  all.tasks.filter((t) => t.ticket === 'SYT-T001').every((t) => t.ticketStatus === 'review')
  && all.tasks.filter((t) => t.ticket === 'SYT-T002').every((t) => t.ticketStatus === 'todo')
  && all.tasks.filter((t) => t.ticket === 'SYT-T011').every((t) => t.ticketStatus === 'doing'));
ok('status: --all widens to every board ticket',
  ticketsIn(all).join() === 'SYT-T001,SYT-T002,SYT-T003,SYT-T004,SYT-T011');

// --- criterion projection (the part that was always right, locked in) ---
const t011 = spec.tasks.filter((t) => t.ticket === 'SYT-T011');
ok('criteria: one task per criterion, id-prefixed',
  t011.length === 2 && t011[0].subject === 'SYT-T011 first' && t011[1].subject === 'SYT-T011 second');
ok('criteria: a checked box maps to completed, an open one to pending',
  t011[0].status === 'pending' && t011[1].status === 'completed');
ok('count: matches the emitted task list', spec.count === spec.tasks.length && spec.count === 5);
ok('prefix: read from config ids.prefix', spec.prefix === 'SYT-T');

// --- the CLI emits the same spec as JSON ---
const cli = spawnSync(process.execPath, [SCRIPT, root], {
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
});
ok('CLI: exits 0 and prints the spec as JSON', cli.status === 0 && JSON.parse(cli.stdout).count === spec.count);

for (const d of [root, PLUGIN_ROOT]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ } }
console.log(`\nsync-tasks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
