// q-model.mjs — the shared item MODEL behind the query surface: the constants, orderings,
// edge-set and graph walk that the SQLite-backed queries (q.mjs) and the markdown-scan
// fallback (q-fallback.mjs) must agree on. Living in one module is what makes cache-vs-scan
// parity (KIT-T026) structural instead of a convention two copies keep drifting from.

import { readIdConfig, STORE_TYPE, compareIds } from './id-utils.mjs';

export const OPEN = ['todo', 'doing', 'review'];
export const FTS_LIMIT = 25;        // cap FTS hits — a retrieval list, not a full dump
export const MIN_TERM_LEN = 2;      // dedup: ignore terms this short or shorter (the, of, a, id)

// Dedup similarity proxy (KIT-T024): turn a proposed title/labels into an FTS OR-query so a
// candidate matches on ANY shared term (a duplicate rarely shares EVERY word). Extracts plain
// barewords (no FTS MATCH syntax injected) and ORs the survivors. Empty in -> a query that
// matches nothing, so a blank proposal surfaces no false candidates.
export const ALNUM_TERM = /[a-z][a-z\d]*/g; // a bareword: leading letter, then letters/digits
export function ftsOrQuery(text) {
  const terms = (String(text || '').toLowerCase().match(ALNUM_TERM) || [])
    .filter((t) => t.length > MIN_TERM_LEN);
  return terms.length ? terms.join(' OR ') : '""';
}

// Dedup is now cross-store (KIT-T025): a proposed item can duplicate one in ANY store, so
// `similar` confines candidates to the store you are creating into. Both the cache and the
// markdown-scan paths split a leading `--store <s>` off the free-text proposal here, so the
// store filter is parsed in ONE place. Default `tickets` keeps KIT-T024 callers unchanged.
export function parseSimilar(text) {
  const m = String(text || '').match(/^\s*--store\s+(\S+)\s*([\s\S]*)$/);
  return { store: m ? m[1] : 'tickets', query: (m ? m[2] : text).trim() };
}

export function storeForType(type) {
  // type may be a store name (tickets) or a type letter/word; map to a store bucket.
  if (STORE_TYPE[type]) return type;
  const byLetter = Object.entries(STORE_TYPE).find(([, l]) => l === type);
  return byLetter ? byLetter[0] : 'tickets';
}

export function formatId(root, scope, type, num) {
  const { pad } = readIdConfig(root);
  const letter = STORE_TYPE[type] || type;
  return `${scope}-${letter}${String(num).padStart(pad, '0')}`;
}

// Open-item ordering — ONE comparator both the cache and the markdown-scan paths sort by,
// so the two are byte-identical (KIT-T026 parity). Priority first (BINARY/code-point order,
// matching SQLite's default collation), then id NUMERICALLY via compareIds (so KIT-T1000
// follows KIT-T999 — which a plain text ORDER BY in SQL gets backwards). Applying it in JS
// on both sides is what removes SQL-text-vs-compareIds as a parity gap.
export const compareOpen = (a, b) =>
  ((a.priority || '') < (b.priority || '') ? -1 : (a.priority || '') > (b.priority || '') ? 1 : 0)
  || compareIds(a.id, b.id);

// A ticket retired by another (KIT-T024): a `superseded` status, or a `superseded_by` pointer
// to its replacement. Either takes it out of the active/drain set. ONE predicate so the cache
// SQL (the open WHERE) and the markdown-scan fallback agree on what "active" means.
export const isSuperseded = (i) => i.status === 'superseded' || !!i.supersededBy;

// An item's outbound edges, mirroring the hydrate edge-set (links/parent/regressed_from/
// introduced_by/caused_by/fixed_by) so the markdown-scan graph queries match the cache.
export const edgesOf = (i) => [
  ...i.links.map((t) => ['link', t]),
  i.parent ? ['parent', i.parent] : null,
  i.regressedFrom ? ['regressed_from', i.regressedFrom] : null,
  i.introducedBy ? ['introduced_by', i.introducedBy] : null,
  i.causingCommit ? ['caused_by', i.causingCommit] : null,
  i.fixedCommit ? ['fixed_by', i.fixedCommit] : null,
  i.supersedes ? ['supersedes', i.supersedes] : null,
  i.supersededBy ? ['superseded_by', i.supersededBy] : null,
].filter(Boolean);

// ANTECEDENT edges — the "inception-out" pointers an item records to where it CAME FROM
// (parent epic, the decisions/docs/tickets that informed it, the thing it supersedes or
// regressed from). The family-tree rule: a descendant points UP to its ancestors; we walk
// these to paint the complete picture for an item before acting on it. `superseded_by` and
// `fixed_by` are DESCENDANT/forward pointers — excluded from the upward walk.
export const ANCESTOR_RELS = new Set(['link', 'parent', 'supersedes', 'regressed_from', 'introduced_by', 'caused_by']);

// Store display order for a trail SUMMARY: governing DECISIONS first, then research/design
// DOCS, then the rest. Lower rank = surfaced first (the trail-on-action rule).
const STORE_RANK = { decisions: 0, research: 1, docs: 1, requests: 2, questions: 3, tickets: 4, notes: 5 };
export const storeRank = (s) => (s in STORE_RANK ? STORE_RANK[s] : 9);

// A trail edge target must be an ITEM id (SCOPE-Letter###) or a commit sha — not the prose
// some legacy `supersedes:`/`source:` fields carry (e.g. "reframes HOD-T009…"). Guarding the
// walk here keeps the trail clean regardless of messy frontmatter; the data smell is flagged
// separately, not papered over.
const ID_SHAPE = /^[A-Za-z]+-[A-Za-z]?\d+$/;
const SHA_SHAPE = /^[0-9a-f]{7,40}$/i;
export const isTrailTarget = (t) => ID_SHAPE.test(t) || SHA_SHAPE.test(t);

// Walk an item's ancestry breadth-first along ANTECEDENT_RELS, returning each reached
// ancestor once (nearest depth wins) with the rel + depth it was reached by. `getEdges(id)`
// yields outbound [rel,to] pairs; `getNode(id)` yields the item record (or undefined for a
// dangling ref / a commit sha). Pure graph walk — same logic for the cache + markdown paths.
export const SUMMARY_CLIP = 80; // chars of the one-line gist a trail shows — a CLUE, not the full record
export const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export function walkAncestry(startId, getEdges, getNode) {
  const seen = new Set([startId]);
  const out = [];
  let frontier = [[startId, 0]];
  while (frontier.length) {
    const next = [];
    for (const [id, depth] of frontier) {
      for (const [rel, to] of getEdges(id)) {
        if (!ANCESTOR_RELS.has(rel) || seen.has(to) || !isTrailTarget(to)) continue;
        seen.add(to);
        const node = getNode(to);
        const isCommit = /^[0-9a-f]{7,40}$/i.test(to);
        // Token-frugal: show the node's `summary` (or a clipped title) — the GIST — plus a
        // `more` clue (✎ = there's a fuller body to drill into). The agent opens a node's
        // full text only when the summary says it needs it (KIT-D028 trail-on-action).
        const gist = node ? (node.summary || node.title || '') : (isCommit ? '(commit)' : '(not in cache: ' + to + ')');
        const bodyLen = node ? (node.bodyLen ?? (node.body ? node.body.length : 0)) : 0;
        const summaryWasClipped = node && !node.summary && String(node.title || '').length > SUMMARY_CLIP;
        out.push({
          id: to,
          store: node ? node.store : (isCommit ? 'commit' : 'missing'),
          rel,
          depth: depth + 1,
          summary: clip(gist, SUMMARY_CLIP),
          more: bodyLen > 0 || summaryWasClipped ? '✎' : '',
        });
        next.push([to, depth + 1]);
      }
    }
    frontier = next;
  }
  // Decisions + docs first (the context the agent must see before acting), then by depth/id.
  return out.sort((a, b) => storeRank(a.store) - storeRank(b.store) || a.depth - b.depth || compareIds(a.id, b.id));
}

// Missing numbers within each (scope,store) sequence — reported, never auto-filled
// (KIT-T009: a returned next-id is always fresh; gaps from deletions stay gaps).
export function findGaps(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.scope}/${r.store}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r.num);
  }
  const gaps = [];
  for (const [k, nums] of byKey) {
    const set = new Set(nums);
    const max = Math.max(...nums);
    for (let n = 1; n < max; n++) if (!set.has(n)) gaps.push(`${k}#${n}`);
  }
  return gaps;
}
