// q-recent.mjs — `q recent [Nd] [scope]`: a time-windowed digest of what HAPPENED,
// driven from the cache's timestamped events — never from prose (KIT-T253).
// Sections: decisions (all), fixed (all), status moves (capped), created (capped).
// Counts stay exact when lists cap. q.mjs wires the DB path; q-fallback the scan path.

import { resolveScope } from './q-model.mjs';

const CAP = 15;          // max rows per capped section; the remainder becomes "+N more"
export const DEFAULT_DAYS = 7;

// "3" / "3d" → days; anything else is a scope token. Order-independent. The scope runs
// through resolveScope, so an absent one means the cwd project and `all` widens (KIT-T255).
export function parseRecentArgs(args, root) {
  let days = DEFAULT_DAYS;
  let scope;
  for (const a of args || []) {
    const m = /^(\d{1,3})d?$/.exec(a);
    if (m) days = Math.max(1, Math.min(90, Number(m[1])));
    else scope = a;
  }
  return { days, scope: resolveScope(scope, root) };
}

export function windowStart(days, now = new Date()) {
  const d = new Date(now.getTime() - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

const cap = (rows, label) => {
  if (rows.length <= CAP) return rows;
  const extra = rows.length - CAP;
  return [...rows.slice(0, CAP), `… +${extra} more ${label}`];
};

export function recentRows(db, args, root, now = new Date()) {
  const { days, scope } = parseRecentArgs(args, root);
  const since = windowStart(days, now);
  const scopeAnd = scope ? ' AND i.scope = ?' : '';
  const p = (base) => (scope ? [...base, scope] : base);

  const decisions = db.all(
    `SELECT i.id, substr(h.ts, 1, 10) AS d, i.title FROM history h JOIN items i ON i.id = h.item_id
     WHERE h.event = 'created' AND h.ts >= ? AND i.store = 'decisions'${scopeAnd} ORDER BY h.ts DESC`, p([since]));
  const fixed = db.all(
    `SELECT i.id, substr(h.ts, 1, 10) AS d, h.detail FROM history h JOIN items i ON i.id = h.item_id
     WHERE h.event = 'fixed' AND h.ts >= ?${scopeAnd} ORDER BY h.ts DESC`, p([since]));
  const moved = db.all(
    `SELECT i.id, h.detail, i.title FROM history h JOIN items i ON i.id = h.item_id
     WHERE h.event = 'status' AND h.ts >= ?${scopeAnd}
     GROUP BY i.id HAVING h.ts = MAX(h.ts) ORDER BY h.ts DESC`, p([since]));
  const created = db.all(
    `SELECT i.id, i.type, i.title FROM history h JOIN items i ON i.id = h.item_id
     WHERE h.event = 'created' AND h.ts >= ? AND i.store <> 'decisions'${scopeAnd} ORDER BY h.ts DESC`, p([since]));

  return digest({ days, since, scope, decisions, fixed, moved, created });
}

// Same digest from the markdown scan's parsed items (each carries .history) — parity
// with the DB path so no-engine environments answer identically.
export function recentFallback(items, args, root, now = new Date()) {
  const { days, scope } = parseRecentArgs(args, root);
  const since = windowStart(days, now);
  const inWin = (ts) => ts && String(ts) >= since;
  const match = (it) => !scope || it.scope === scope;
  const decisions = [], fixed = [], moved = [], created = [];
  for (const it of items) {
    if (!match(it)) continue;
    let lastStatus;
    for (const h of it.history || []) {
      if (!inWin(h.ts)) continue;
      if (h.event === 'created') {
        (it.store === 'decisions' ? decisions : created).push(
          it.store === 'decisions'
            ? { id: it.id, d: String(h.ts).slice(0, 10), title: it.title }
            : { id: it.id, type: it.type, title: it.title });
      } else if (h.event === 'fixed') {
        fixed.push({ id: it.id, d: String(h.ts).slice(0, 10), detail: h.detail });
      } else if (h.event === 'status') {
        if (!lastStatus || String(h.ts) > String(lastStatus.ts)) lastStatus = h;
      }
    }
    if (lastStatus) moved.push({ id: it.id, detail: lastStatus.detail, title: it.title });
  }
  return digest({ days, since, scope, decisions, fixed, moved, created });
}

function digest({ days, since, scope, decisions, fixed, moved, created }) {
  return {
    window: `${since} → now (${days}d${scope ? `, ${scope}` : ''})`,
    decisions,
    fixed,
    [`moved (${moved.length})`]: cap(moved, 'moves'),
    [`created (${created.length})`]: cap(created, 'created'),
  };
}
