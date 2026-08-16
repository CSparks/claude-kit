// provenance.mjs — the enforcement side of KIT-D028 (provenance is mandatory): an item must
// point UP to where it came from, and that trail is surfaced at the moment of action.
//
//   antecedentRows(trail)          the trail rows that are ANCESTORS (everything but `self`)
//   renderTrail(trail, opts)       compact trail lines for a CLI/hook banner
//   readProvenanceGate(root)       .ai/config.yml -> provenance.gate ('warn' | 'block')
//   trailGate({ trail, gate, ... })verdict for a ticket-start: ok | warn | block
//   orphanRows(items, getEdges)    items with NO outbound antecedent edge (the lint)
//
// No SQLite here — callers hand in rows, so the cache path and the markdown-scan path share
// one implementation.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANCESTOR_RELS, isTrailTarget, clip, SUMMARY_CLIP, storeRank } from './q-model.mjs';
import { compareIds } from './id-utils.mjs';

// Stores whose items are expected to carry provenance. Notes/questions/inbox captures are
// raw material — demanding an antecedent of them would make the lint pure noise.
const LINTED_STORES = new Set(['tickets', 'decisions']);
const OPEN_STATUSES = new Set(['todo', 'doing', 'review']);
const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

export const antecedentRows = (trail) => (trail || []).filter((r) => r.rel !== 'self');

// One line per trail node: `  D028 (decisions, via link) — <summary> ✎`. `limit` caps the
// body so a banner stays token-frugal; the overflow is reported as a count, never dropped
// silently.
export function renderTrail(trail, { limit = 5, indent = '  ' } = {}) {
  const rows = antecedentRows(trail);
  if (!rows.length) return [`${indent}(no antecedents — this item points at nothing upstream)`];
  const lines = rows.slice(0, limit)
    .map((r) => `${indent}${r.id} (${r.store}, via ${r.rel}) — ${clip(r.summary, SUMMARY_CLIP)}${r.more ? ' ✎' : ''}`);
  if (rows.length > limit) lines.push(`${indent}+${rows.length - limit} more — q trail <id>`);
  return lines;
}

// `provenance:\n  gate: block` in .ai/config.yml. Line-wise, like every other config reader
// in the kit (no YAML dep). Default `warn`: a freshly-promoted capture arrives link-less by
// construction, so a hard block by default would wedge every new bug at its first transition.
export function readProvenanceGate(root, aiDir = join(root, '.ai')) {
  try {
    const cfg = readFileSync(join(aiDir, 'config.yml'), 'utf8');
    const m = cfg.match(/^provenance:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+gate:[ \t]*(\w+)/m);
    return m && m[1] === 'block' ? 'block' : 'warn';
  } catch {
    return 'warn';
  }
}

// The ticket-start verdict. `escape` is the operator's stated reason for proceeding without
// a trail (t status --no-trail-check "<reason>"); it downgrades a block to a warning and is
// recorded by the caller, never silent.
export function trailGate({ id, trail, gate = 'warn', escape = '' }) {
  const lines = renderTrail(trail);
  if (antecedentRows(trail).length) return { level: 'ok', lines, message: '' };
  const how = `Link it: t link ${id} link <decision-or-ticket-id> (or parent/regressed_from/supersedes).`;
  if (escape) {
    return { level: 'warn', lines, message: `${id}: no antecedent — proceeding on --no-trail-check: ${escape}` };
  }
  if (gate === 'block') {
    return {
      level: 'block',
      lines,
      message: `${id}: no outbound antecedent link — provenance.gate is 'block' (KIT-D028).\n${how}\n` +
        'Deliberate exception: --no-trail-check "<reason>".',
    };
  }
  return { level: 'warn', lines, message: `${id}: no outbound antecedent link (KIT-D028). ${how}` };
}

// The lint (`q orphans`): items in a linted store with no outbound antecedent edge at all.
// `getEdges(id)` yields [rel, to] pairs — the caller supplies them from the links table or
// from edgesOf(), so cache and scan see the same graph.
export function orphanRows(items, getEdges, scope = '') {
  const linted = items.filter((i) => LINTED_STORES.has(i.store) && !i.archived
    && (!scope || i.scope === scope)
    && (i.store === 'decisions' || OPEN_STATUSES.has(i.status)));
  return linted
    .filter((i) => !(getEdges(i.id) || []).some(([rel, to]) => ANCESTOR_RELS.has(rel) && isTrailTarget(to)))
    .map((i) => ({
      id: i.id,
      store: i.store,
      type: i.type,
      status: i.status,
      priority: i.priority || '',
      summary: clip(i.summary || i.title || '', SUMMARY_CLIP),
    }))
    .sort((a, b) => storeRank(a.store) - storeRank(b.store)
      || prioRank(a.priority) - prioRank(b.priority)
      || compareIds(a.id, b.id));
}

const prioRank = (p) => {
  const i = PRIORITY_ORDER.indexOf(String(p || '').toLowerCase());
  return i < 0 ? PRIORITY_ORDER.length : i;
};
