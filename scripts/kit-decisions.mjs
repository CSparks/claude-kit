// kit-decisions.mjs — the kit's recent decisions, replayed to every project's session (KIT-T507).
// A directive recorded as a kit decision binds every project, but orient only lists the current
// project's own decisions; this lists the kit store's last few days so no session works blind to one.
//
// `recentKitDecisions(root, { days, now, kitRoot })` → lines for orient; [] when `root` is the kit
// itself (its own list already shows them), the kit store is unregistered, or nothing is recent.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { kitStoreRoot } from './kit-bug.mjs';

const DAYS = 3;
const MS_PER_DAY = 86400000;
const TITLE_MAX = 140;
const field = (text, name) => (new RegExp(`^${name}:[ \\t]*(.*)$`, 'm').exec(text) || [, ''])[1].trim();
const clip = (s) => (s.length > TITLE_MAX ? `${s.slice(0, TITLE_MAX - 1)}…` : s);

export function recentKitDecisions(root, { days = DAYS, now = Date.now(), kitRoot = kitStoreRoot() } = {}) {
  if (!kitRoot || resolve(kitRoot) === resolve(root)) return [];
  const dir = join(kitRoot, '.ai', 'decisions');
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || /^(README|_TEMPLATE)/i.test(name)) continue;
    const head = readFileSync(join(dir, name), 'utf8').slice(0, 1500);
    const date = Date.parse(field(head, 'date'));
    if (Number.isFinite(date) && now - date <= days * MS_PER_DAY) rows.push({ id: field(head, 'id'), title: field(head, 'title') });
  }
  if (!rows.length) return [];
  return ['', `--- Kit decisions, last ${days} days (they bind every project; cite, never re-ask) ---`, ...rows.sort((a, b) => a.id.localeCompare(b.id)).map((r) => `  ${r.id} — ${clip(r.title)}`)];
}
