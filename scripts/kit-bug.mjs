// kit-bug.mjs — every kit bug and needed kit feature becomes a ticket at once (KIT-T286), from ANY
// session: the kit is everyone's business. Any tool, hook or script that notices the KIT itself
// misbehaving or lacking something files a deduped ticket labelled kit-bug (or kit-feature) in the
// kit's own store; orient lists the open ones as dispatch-now. Never throws: filing is best-effort and must not cost the caller.
//
//   fileKitBug({ shape, title, detail, project }) -> { id, created } | null
//   commentKitBug({ shape, text, project })       -> { id } | null: a comment on the OPEN ticket of that shape, never a new ticket
//   openKitBugs(limit)                            -> [{ id, title, status, priority }] most urgent first
//   openKitBugPage(limit)                         -> { bugs, total }
//   kitStoreRoot()                                -> the kit repo root, or null
//
// The kit store is the registry project `claude-kit` (CLAUDE_KIT_BUG_STORE overrides the root;
// unset + unregistered = nothing is filed). `shape` is the dedup key: one open ticket per shape.

import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRegistry } from '../hooks/lib.mjs';
import { scaffoldNew, readConfig } from './t.mjs';
import { bumpAsked } from './asked-again.mjs';
import { stamp } from './md-body.mjs';
import { pathKey, statCached, statMarkdownFiles } from '../hooks/lib/stat-cache.mjs';

const KIT_PROJECT = 'claude-kit';
const LABELS = { bug: 'kit-bug', feature: 'kit-feature' };
const ANY_LABEL = /^labels:.*kit-(?:bug|feature)/m;
const CLOSED = /^status:\s*(?:review|done|superseded)\b/m;
const SHAPE_LINE = /^kit-bug-shape:\s*(.+)$/m;
const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];
const TITLE_MAX = 140;
const EXAMPLE_MAX = 300; // the one-line "seen again" comment only; a ticket's Description keeps the full capture

export function kitStoreRoot() {
  const forced = process.env.CLAUDE_KIT_BUG_STORE;
  if (forced) return existsSync(join(forced, '.ai', 'config.yml')) ? forced : null;
  try {
    const dir = readRegistry().projects[KIT_PROJECT];
    return dir && existsSync(join(dir, '.ai', 'config.yml')) ? dir : null;
  } catch {
    return null;
  }
}

const ticketFiles = (root) => {
  const dir = join(root, '.ai', 'tickets');
  try { return readdirSync(dir).filter((n) => n.endsWith('.md') && !n.startsWith('_') && n !== 'INDEX.md').map((n) => join(dir, n)); } catch { return []; }
};

function openFor(root, shape) {
  for (const p of ticketFiles(root)) {
    const text = readFileSync(p, 'utf8');
    const m = SHAPE_LINE.exec(text);
    if (m && m[1].trim() === shape && !CLOSED.test(text)) return { path: p, text };
  }
  return null;
}

// `repeatAsk` marks a human capture: an exact shape match then also escalates the ticket (KIT-T405).
export function fileKitBug({ shape, title, detail = '', project = '', kind = 'bug', repeatAsk = false }) {
  try {
    const root = kitStoreRoot();
    if (!root || !shape) return null;
    const full = String(detail).trim();
    const example = full.replace(/\s+/g, ' ').slice(0, EXAMPLE_MAX);
    const where = project ? ` in ${project}` : '';
    const open = openFor(root, shape);
    if (open) {
      const idm = /^id:\s*(\S+)/m.exec(open.text);
      const line = `- [${stamp()}] (comment) seen again${where}: ${example}\n`;
      if (!open.text.includes(`seen again${where}: ${example}`)) appendFileSync(open.path, line);
      if (repeatAsk) bumpAsked(open.path, shape, readConfig(root).priorities);
      return { id: idm ? idm[1] : '', created: false };
    }
    const description = `${full}\n\nkit-bug-shape: ${shape}\nfirst seen${where}. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).`;
    const { id, path } = scaffoldNew(root, kind === 'feature' ? 'feature' : 'bug', String(title).slice(0, TITLE_MAX), { description });
    writeFileSync(path, readFileSync(path, 'utf8').replace(/^labels: \[\]$/m,`labels: [${LABELS[kind] || LABELS.bug}]`));
    return { id, created: true };
  } catch {
    return null;
  }
}

export function commentKitBug({ shape, text, project = '' }) {
  try {
    const root = kitStoreRoot();
    const open = root && shape ? openFor(root, shape) : null;
    if (!open) return null;
    const where = project ? ` in ${project}` : '';
    appendFileSync(open.path, `- [${stamp()}] (comment) update${where}: ${String(text).replace(/\s+/g, ' ').slice(0, EXAMPLE_MAX)}\n`);
    return { id: (/^id:\s*(\S+)/m.exec(open.text) || [, ''])[1] };
  } catch {
    return null;
  }
}

// What openKitBugs needs from one ticket, computed once per file change (stat-keyed cache):
// the kit store holds hundreds of tickets and opening each one costs ~0.4 ms.
function bugRow(path) {
  const text = readFileSync(path, 'utf8');
  return {
    open: ANY_LABEL.test(text) && !CLOSED.test(text),
    status: (/^status:\s*(\S+)/m.exec(text) || [, ''])[1],
    id: (/^id:\s*(\S+)/m.exec(text) || [, ''])[1],
    title: (/^title:\s*(.+)$/m.exec(text) || [, ''])[1],
    priority: (/^priority:\s*(\S+)/m.exec(text) || [, ''])[1],
    asked: Number((/^asked:\s*(\d+)/m.exec(text) || [, 1])[1]),
    created: Date.parse((/^created:\s*(\S+)/m.exec(text) || [, ''])[1]) || 0,
  };
}

const rankOf = (priority) => {
  const rank = PRIORITY_ORDER.indexOf(priority);
  return rank < 0 ? PRIORITY_ORDER.length : rank;
};
// Highest priority first, then the most-asked, then the newest: the bug that matters most is never lost in file order.
const byUrgency = (a, b) => rankOf(a.priority) - rankOf(b.priority) || b.asked - a.asked || b.created - a.created;

/** The open kit tickets with no agent yet, most urgent first: { bugs: first `limit`, total }. */
export function openKitBugPage(limit = 8) {
  const root = kitStoreRoot();
  if (!root) return { bugs: [], total: 0 };
  const dir = join(root, '.ai', 'tickets');
  const files = statMarkdownFiles(dir, (n) => n.startsWith('_') || n === 'INDEX.md');
  const rows = statCached(`kit-bugs-${pathKey(dir)}`, files, bugRow)
    .filter((r) => r.open && r.status !== 'doing') // a doing ticket already has an agent
    .sort(byUrgency);
  return { bugs: rows.slice(0, limit).map(({ id, title, status, priority }) => ({ id, title, status, priority })), total: rows.length };
}

export const openKitBugs = (limit = 8) => openKitBugPage(limit).bugs;

const SHOWN_TITLE_MAX = 120;
const clipTitle = (s) => (s.length > SHOWN_TITLE_MAX ? s.slice(0, SHOWN_TITLE_MAX - 1) + '…' : s);

/** The standing-agent rule orient replays with the open kit tickets (KIT-D094). */
export const STANDING_KIT_AGENT = 'Policy (KIT-D094): keep ONE standing kit agent (writer in the claude-kit checkout, reused warm); hand it every kit misbehaviour at once (ticket, diagnosis, fix, publish). No inline kit diagnosis by the orchestrator.';

/** Orient's DISPATCH NOW block for open kit tickets: [] when none are open. */
export function kitBugBlock(page = openKitBugPage()) {
  const { bugs, total = bugs.length } = Array.isArray(page) ? { bugs: page } : page;
  if (!bugs.length) return [];
  return [
    `--- DISPATCH NOW: open kit-bug / kit-feature tickets, ${total} open, showing ${bugs.length} (dispatch required: a kit bug or missing feature needs an agent in the claude-kit checkout, never a workaround; filing a ticket dispatches nothing) ---`,
    `  ${STANDING_KIT_AGENT}`,
    ...bugs.map((b) => `  ${b.id}${b.priority ? ` [${b.priority}]` : ''} — ${clipTitle(b.title)}`),
    '',
  ];
}
