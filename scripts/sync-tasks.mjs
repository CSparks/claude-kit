#!/usr/bin/env node
// Emit the native-task spec for the ACTIVE tickets, so a session can hydrate the native task
// list from the durable .ai/ tickets (D-005). Read-only — prints JSON; it does not touch the
// native list (only Claude's Task tools can), it tells Claude what to create.
//
//   node scripts/sync-tasks.mjs [repoRoot]          # defaults to cwd
//   node scripts/sync-tasks.mjs [repoRoot] --all    # every board ticket, not just `doing`
//
// Each acceptance criterion becomes one task titled "<id> <criterion>" — the id prefix marks it
// ticket-backed. A ticket with no criteria yields one task from its title, carrying the ticket's
// mapped status. Checked criteria -> completed, unchecked -> pending; the lockstep rules flip
// the active one to in_progress.
//
// KIT-T169 (measured in gridiron-blitz, 2026-08-02 — a ~76-task spec that was mostly garbage):
// the id came from the FILENAME, so a slug carrying digits (`GB-T011-…-v23-regressed-the-2-r.md`)
// yielded ticket "the-2"; INDEX.md and _TEMPLATE.md were read as tickets; an EMPTY acceptance
// checklist let a whole-file checkbox scan escape the section and emit a bogus "## Plan" task;
// and the local status parse disagreed with index-tickets.mjs so every ticket read `todo`.
// The invariants that replaced them: the id is the FRONTMATTER id (no filename fallback — no
// id, not a ticket), criteria are read through criteria.mjs (section-scoped, same parser the
// `t` CLI ticks with), and status comes from the shared frontmatter parser.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// The ONE comment-aware, CRLF-tolerant parser (KIT-T107/KIT-T110). The local copies removed
// here were LF-only and comment-blind, so a CRLF ticket emitted nothing and a template-derived
// `status: todo   # todo | doing | …` read as the whole comment string.
import { frontmatterBlock, field } from './frontmatter.mjs';
import { listCriteria } from './criteria.mjs';

const DEFAULT_MAP = { todo: 'pending', doing: 'in_progress', review: 'completed', done: 'completed' };
// Generated/reference files that live in the ticket dir but are not tickets (index-tickets' set).
const SKIP = new Set(['_TEMPLATE.md', 'INDEX.md', 'README.md', 'REGRESSIONS.md', 'ROADMAP.md']);
// The hydrate contract (CLAUDE.md): the native list projects the ticket(s) being WORKED.
const ACTIVE_STATUS = 'doing';

// Light, dependency-free read of the two config bits we need (no YAML lib).
function loadConfig(root) {
  let prefix = 'T-';
  const map = { ...DEFAULT_MAP };
  try {
    const cfg = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
    const pm = cfg.match(/prefix:\s*"([^"]+)"/);
    if (pm) prefix = pm[1];
    const block = cfg.match(/status_map:\s*\n((?:[ \t]+\w+:[ \t]*\w+\n?)+)/);
    if (block) {
      for (const line of block[1].split('\n')) {
        const m = line.match(/\s+(\w+):\s*(\w+)/);
        if (m) map[m[1]] = m[2];
      }
    }
  } catch {
    /* fall back to defaults */
  }
  return { prefix, map };
}

// A ticket dir entry -> its parsed identity, or null when the file is not a ticket. A file with
// no frontmatter `id:` is the generated view / template / stray note case: skipped outright
// rather than guessed at from the filename, which is what minted the "the-2" phantom.
function readTicket(dir, file) {
  if (!file.endsWith('.md') || SKIP.has(file)) return null;
  const text = readFileSync(join(dir, file), 'utf8');
  const fm = frontmatterBlock(text);
  const id = field(fm, 'id');
  if (!id) return null;
  return { id, text, status: field(fm, 'status') || 'todo', title: field(fm, 'title') || id };
}

// The tasks one ticket projects. Criteria come from criteria.mjs — scoped to the ticket's
// `## Acceptance Criteria` section, so a `- [ ]` under Plan or Notes is never mistaken for one —
// and the scaffold's empty `- [ ]` placeholder carries no text, so it contributes no task.
function ticketTasks(ticket, map) {
  const criteria = listCriteria(ticket.text).filter((c) => c.text);
  if (!criteria.length) {
    return [{ ticket: ticket.id, ticketStatus: ticket.status, subject: `${ticket.id} ${ticket.title}`, status: map[ticket.status] || 'pending' }];
  }
  return criteria.map((c) => ({
    ticket: ticket.id,
    ticketStatus: ticket.status,
    subject: `${ticket.id} ${c.text}`,
    status: c.checked ? 'completed' : 'pending',
  }));
}

// The native-task spec for `root`. `all: true` widens past the active ticket(s) to every ticket
// on the board — a diagnostic view, never what /work hydrates from.
export function taskSpec(root, { all = false } = {}) {
  const { prefix, map } = loadConfig(root);
  const ticketsDir = join(root, '.ai', 'tickets');
  const files = existsSync(ticketsDir) ? readdirSync(ticketsDir) : [];
  const tasks = [];
  for (const f of files) {
    const ticket = readTicket(ticketsDir, f);
    if (!ticket) continue;
    if (!all && ticket.status !== ACTIVE_STATUS) continue;
    tasks.push(...ticketTasks(ticket, map));
  }
  return { prefix, count: tasks.length, tasks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const root = args.find((a) => !a.startsWith('--')) || process.cwd();
  process.stdout.write(JSON.stringify(taskSpec(root, { all }), null, 2) + '\n');
}
