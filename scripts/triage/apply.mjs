// triage/apply.mjs — APPLY (KIT-T027 step 3). Consume a decisions JSON (the LLM's classification of
// the ambiguous caps + the auto-included deterministic ones) and enact each: create/fold/supersede/
// skip. Ids come from next-id on the held handle (NEVER hand-picked — KIT-T009). Every processed cap
// moves to inbox/triaged/. Then re-sync the cache and print cross-project receipts + a drain-ordered
// worklist per scope (each scope's own config.drain.order).

import { readFileSync } from 'node:fs';
import { resolveEngine } from '../db-engine.mjs';
import { hydrate } from '../hydrate-db.mjs';
import { readIdConfig, maxStoreNum, formatItemId, compareIds } from '../id-utils.mjs';
import { openHandle } from './handle.mjs';
import { loadScope, scopeIndex, ROUTE_STORE } from './config.mjs';
import { capText, capTitle, truncate } from './cap-text.mjs';
import { writeFromTemplate, foldNote, supersede, markSupersedes, moveCapToTriaged } from './write-item.mjs';
import { commitApply } from './commit.mjs';

const OPEN_STATUSES = ['todo', 'doing', 'review'];
const TITLE_COL = 60;

// The batch allocator. Three floors, all of which have been the cause of a real collision:
//   • the CACHE's MAX(num) — fast, but derived, and wrong whenever it is stale;
//   • the files ON DISK — the truth, and the floor a stale cache silently sank below when
//     triage re-minted GB-T001..T005 over five live tickets (KIT-T166);
//   • `alloc`, this run's high-water mark per scope/store — the cache is not re-synced between
//     creates, so without it every create in one batch lands on the same id (KIT-T009).
// Exported so the allocator is testable directly, without driving a whole --apply batch.
export function mintId(db, scope, store, root, alloc, aiDir) {
  const row = db.all('SELECT MAX(num) AS m FROM items WHERE scope = ? AND store = ?', [scope, store])[0];
  const key = `${scope}/${store}`;
  const onDisk = maxStoreNum(root, store, aiDir);
  const next = Math.max(row && row.m ? row.m : 0, onDisk, alloc.get(key) || 0) + 1;
  alloc.set(key, next);
  return formatItemId(scope, store, next, readIdConfig(root).pad);
}

function resolveRouteStore(decision, sc) {
  const route = decision.route || (sc.classifications[decision.classification] || {}).route;
  return ROUTE_STORE[route] || 'tickets';
}

function priorityOf(decision, sc) {
  return decision.priority || (sc.classifications[decision.classification] || {}).priority || null;
}

// An accepted backward-provenance link on a decision (KIT-T065): the maintainer/LLM accepted one of
// the inferred candidates (or supplied their own). Default the marker to `inferred` (the triage-time
// guess) unless the decision says `given` — a wrong inference is then auditable, never silently
// authoritative. Returns null when the decision carries no provenance, so createItem writes nothing.
function provenanceOf(d) {
  const p = d.provenance;
  if (!p || (!p.regressed_from && !p.causing_commit && !p.introduced_by)) return null;
  return {
    regressed_from: p.regressed_from || null,
    causing_commit: p.causing_commit || null,
    introduced_by: p.introduced_by || null,
    mark: p.mark === 'given' ? 'given' : 'inferred',
  };
}

function createItem(db, cap, sc, d, alloc, extraLinks = []) {
  const store = resolveRouteStore(d, sc);
  const id = mintId(db, cap.scope, store, sc.root, alloc, sc.aiDir);
  const text = capText(cap.body);
  // title = the cap's one-line LABEL; text = the whole capture, which belongs in the body only.
  // Passing the raw text as the title is what broke 39 items' frontmatter across two runs (KIT-T126).
  const rel = writeFromTemplate({
    aiDir: sc.aiDir, store, id, type: d.classification, status: sc.flowHead,
    priority: priorityOf(d, sc), title: capTitle(text), links: [...(d.links || []), ...extraLinks].filter(Boolean), text,
    provenance: provenanceOf(d),
  });
  return { id, rel };
}

function enact(db, d, cap, sc, alloc) {
  const text = capText(cap.body);
  switch (d.action || 'create') {
    case 'create': return createItem(db, cap, sc, d, alloc).rel;
    case 'fold': return foldNote(sc.aiDir, d.target, text) || `fold target ${d.target} not found`;
    case 'supersede': {
      const { id, rel } = createItem(db, cap, sc, d, alloc, [d.target]);
      if (supersede(sc.aiDir, id, d.target)) markSupersedes(sc.aiDir, rel, d.target);
      return rel;
    }
    case 'skip': return 'skipped';
    default: return `unknown action '${d.action}'`;
  }
}

export async function apply({ decisionsPath, json, dbPath }) {
  const handle = await openHandle(dbPath);
  if (!handle) { process.stderr.write('triage: no SQLite engine.\n'); process.exit(1); }
  const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8'));
  const scopes = scopeIndex();
  const configs = new Map();
  for (const [scope, { aiDir, root }] of scopes) configs.set(scope, loadScope(aiDir, root));
  const receipts = [];
  const alloc = new Map(); // batch-local id high-water mark per scope/store (KIT-T009 collision guard)
  try {
    for (const d of decisions) {
      const cap = handle.all(
        'SELECT i.id, i.scope, i.file, f.body FROM items i JOIN items_fts f ON f.id = i.id WHERE i.id = ?',
        [d.capId],
      )[0];
      if (!cap) { receipts.push({ capId: d.capId, scope: '?', action: d.action || 'create', dest: 'cap not found' }); continue; }
      const sc = configs.get(cap.scope);
      if (!sc) { receipts.push({ capId: d.capId, scope: cap.scope, action: 'skip', dest: 'unknown scope' }); continue; }
      // A refused create (id collision — KIT-T166) fails THAT cap, not the batch: the cap stays
      // in the inbox for a retry after a re-hydrate, and the error is carried in its receipt so
      // it is impossible to miss in the output.
      let dest;
      try {
        dest = enact(handle, d, cap, sc, alloc);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        process.stderr.write(`triage: ${d.capId} NOT applied — ${msg}\n`);
        receipts.push({ capId: d.capId, scope: cap.scope, action: d.action || 'create', dest: `ERROR: ${msg}`, capFile: cap.file });
        continue;
      }
      const movedTo = moveCapToTriaged(sc.aiDir, cap.file);
      receipts.push({ capId: d.capId, scope: cap.scope, action: d.action || 'create', dest, movedTo, capFile: cap.file });
    }
  } finally {
    handle.close();
  }
  // Commit triage's OWN output before the cache re-sync so the descriptive message lands with the
  // files (the Stop-hook sync only handles the raw caps). aiDir per scope is where the markdown —
  // and thus the git working tree — lives. Fail-open: never break a succeeded apply on a commit.
  const aiDirByScope = new Map([...configs].map(([scope, sc]) => [scope, sc.aiDir]));
  commitApply({ applied: receipts, aiDirByScope });
  await hydrate({ dbPath, ifStale: true }); // make the just-written items queryable
  const worklists = await drainWorklists(scopes, dbPath);
  const result = { applied: receipts, worklists };
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else printApply(result);
  return result;
}

// Drain-ordered open tickets per scope: the scope's own config.drain.order (type order) then
// priority then id — the worklist the maintainer drains next.
async function drainWorklists(scopes, dbPath) {
  const open = await resolveEngine();
  if (!open) return {};
  const handle = open(dbPath);
  const out = {};
  try {
    for (const [scope, { aiDir, root }] of scopes) {
      const sc = loadScope(aiDir, root);
      const rows = handle.all(
        `SELECT id, type, status, priority, title FROM items
         WHERE scope = ? AND store = 'tickets' AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})
           AND archived = 0 AND status <> 'superseded'`,
        [scope, ...OPEN_STATUSES],
      );
      if (!rows.length) continue;
      const orderIdx = (t) => {
        const i = sc.drainOrder.indexOf(t);
        return i < 0 ? sc.drainOrder.length : i;
      };
      rows.sort((a, b) => orderIdx(a.type) - orderIdx(b.type)
        || (a.priority || '').localeCompare(b.priority || '')
        || compareIds(a.id, b.id));
      out[scope] = rows;
    }
  } finally {
    handle.close();
  }
  return out;
}

function printApply({ applied, worklists }) {
  process.stdout.write('triage applied:\n\n');
  const byScope = new Map();
  for (const r of applied) {
    if (!byScope.has(r.scope)) byScope.set(r.scope, []);
    byScope.get(r.scope).push(r);
  }
  for (const [scope, rows] of [...byScope].sort((a, b) => a[0].localeCompare(b[0]))) {
    process.stdout.write(`${scope}\n`);
    for (const r of rows) process.stdout.write(`  ${r.capId} → ${r.action}: ${r.dest}\n`);
    process.stdout.write('\n');
  }
  process.stdout.write('drain worklist:\n');
  for (const [scope, rows] of Object.entries(worklists)) {
    process.stdout.write(`${scope}\n`);
    for (const r of rows) {
      process.stdout.write(`  ${r.id} [${r.type}/${r.priority || '-'}] ${truncate(r.title || '', TITLE_COL)}\n`);
    }
  }
}
