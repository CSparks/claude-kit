// q-inbox.mjs — the inbox verbs of the q surface (KIT-T238): `q inbox [scope]
// [--older-than Nd]` and `q confirmations` (inbox items aged past the confirmation
// threshold). Shared by the cache-backed and markdown-scan paths so both answer
// identically; the caller supplies the raw item rows and a scope→.ai-dir resolver.
//
//   parseInboxArgs(args, root)  -> { scope, olderThanDays }
//   ageDays(file, mtimeMs, now) -> whole days since capture (filename date, else mtime)
//   inboxRows(items, opts)      -> [{ id, age, scope, title, path }]

import { join } from 'node:path';
import { defaultScope, clip, SUMMARY_CLIP } from './q-model.mjs';

// Items unconfirmed for this many days need a human — the fixed filter behind
// `q confirmations`.
export const CONFIRMATION_DAYS = 3;

const MS_PER_DAY = 86400000;

// `--older-than 3d` / `3` / `72h`. Returns days as a float (an hours form can be < 1).
export function parseAge(text) {
  const m = String(text || '').trim().match(/^(\d+(?:\.\d+)?)\s*([dh])?$/i);
  if (!m) throw new Error(`q inbox: --older-than wants a duration like 3d or 12h, got '${text}'.`);
  const n = parseFloat(m[1]);
  return (m[2] || 'd').toLowerCase() === 'h' ? n / 24 : n;
}

// Split `[scope] [--older-than Nd]`. The scope defaults to the cwd project (as `fts` does),
// and `all` widens to every project. `--older-than` may sit anywhere among the args.
export function parseInboxArgs(args, root) {
  const rest = [];
  let olderThanDays = 0;
  const list = Array.isArray(args) ? args : String(args || '').split(/\s+/).filter(Boolean);
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '--older-than') { olderThanDays = parseAge(list[++i]); continue; }
    const inline = String(list[i]).match(/^--older-than=(.+)$/);
    if (inline) { olderThanDays = parseAge(inline[1]); continue; }
    rest.push(list[i]);
  }
  const raw = rest[0];
  const scope = raw ? (/^all$/i.test(raw) ? '' : raw) : defaultScope(root);
  return { scope, olderThanDays };
}

// Capture date: `cap` names inbox files `YYYY-MM-DD[-HHMM]-slug.md`, which survives a copy
// or a re-clone; the file mtime is only the fallback for a differently-named capture.
export function ageDays(file, mtimeMs, now = Date.now()) {
  const m = String(file || '').match(/(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?/);
  const stamp = m
    ? Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0)
    : (mtimeMs === null || mtimeMs === undefined ? NaN : Number(mtimeMs));
  if (!Number.isFinite(stamp)) return null;
  return Math.max(0, (now - stamp) / MS_PER_DAY);
}

const label = (days) => (days === null ? '?' : days < 1 ? `${Math.floor(days * 24)}h` : `${Math.floor(days)}d`);

// A cap has no frontmatter, so its "title" is the first line of its body minus the
// leading `(type)` tag cap.mjs writes.
function summarize(item) {
  if (item.title) return item.title;
  const first = String(item.body || '').split(/\r?\n/).find((l) => l.trim()) || '';
  return clip(first.replace(/^\(([a-z][\w-]*)\)\s*/i, '').trim(), SUMMARY_CLIP);
}

// Shape + filter the inbox rows. `items` carry { id, scope, title, type, body, file, mtimeMs? };
// `aiDirFor` maps a scope to its .ai directory so each row prints the path a human can open.
export function inboxRows(items, { scope = '', olderThanDays = 0, now = Date.now(), aiDirFor = () => '' } = {}) {
  return items
    .filter((i) => !scope || i.scope === scope)
    .map((i) => ({ item: i, days: ageDays(i.file, i.mtimeMs, now) }))
    .filter(({ days }) => !olderThanDays || (days !== null && days >= olderThanDays))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || String(a.item.file).localeCompare(String(b.item.file)))
    .map(({ item, days }) => ({
      id: item.id,
      age: label(days),
      scope: item.scope,
      type: item.type || '',
      title: summarize(item),
      path: join(aiDirFor(item.scope) || '', item.file || ''),
    }));
}
