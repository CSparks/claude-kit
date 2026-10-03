// kit-bug.mjs — every kit bug and needed kit feature becomes a ticket at once (KIT-T286), from ANY
// session: the kit is everyone's business. Any tool, hook or script that notices the KIT itself
// misbehaving or lacking something files a deduped ticket labelled kit-bug (or kit-feature) in the
// kit's own store; orient lists the open ones as dispatch-now. Never throws: filing is best-effort and must not cost the caller.
//
//   fileKitBug({ shape, title, detail, project }) -> { id, created } | null
//   openKitBugs(limit)                            -> [{ id, title, status }]
//   kitStoreRoot()                                -> the kit repo root, or null
//
// The kit store is the registry project `claude-kit` (CLAUDE_KIT_BUG_STORE overrides the root;
// unset + unregistered = nothing is filed). `shape` is the dedup key: one open ticket per shape.

import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRegistry } from '../hooks/lib.mjs';
import { scaffoldNew } from './t.mjs';
import { stamp } from './md-body.mjs';

const KIT_PROJECT = 'claude-kit';
const LABELS = { bug: 'kit-bug', feature: 'kit-feature' };
const ANY_LABEL = /^labels:.*kit-(?:bug|feature)/m;
const CLOSED = /^status:\s*(?:review|done|superseded)\b/m;
const SHAPE_LINE = /^kit-bug-shape:\s*(.+)$/m;
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

export function fileKitBug({ shape, title, detail = '', project = '', kind = 'bug' }) {
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
      return { id: idm ? idm[1] : '', created: false };
    }
    const description = `${full}\n\nkit-bug-shape: ${shape}\nfirst seen${where}. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.`;
    const { id, path } = scaffoldNew(root, kind === 'feature' ? 'feature' : 'bug', String(title).slice(0, TITLE_MAX), { description });
    writeFileSync(path, readFileSync(path, 'utf8').replace(/^labels: \[\]$/m,`labels: [${LABELS[kind] || LABELS.bug}]`));
    return { id, created: true };
  } catch {
    return null;
  }
}

export function openKitBugs(limit = 8) {
  const root = kitStoreRoot();
  if (!root) return [];
  const out = [];
  for (const p of ticketFiles(root)) {
    const text = readFileSync(p, 'utf8');
    if (!ANY_LABEL.test(text) || CLOSED.test(text)) continue;
    const status = (/^status:\s*(\S+)/m.exec(text) || [, ''])[1];
    if (status === 'doing') continue; // an agent already has it
    out.push({ id: (/^id:\s*(\S+)/m.exec(text) || [, ''])[1], title: (/^title:\s*(.+)$/m.exec(text) || [, ''])[1], status });
  }
  return out.slice(0, limit);
}
