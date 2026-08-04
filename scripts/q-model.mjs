// q-model.mjs — the shared item MODEL behind the query surface: the constants, orderings,
// edge-set and graph walk that the SQLite-backed queries (q.mjs) and the markdown-scan
// fallback (q-fallback.mjs) must agree on. Living in one module is what makes cache-vs-scan
// parity (KIT-T026) structural instead of a convention two copies keep drifting from.

import { resolve } from 'node:path';
import { readIdConfig, STORE_TYPE, compareIds } from './id-utils.mjs';
import { storeRoot } from '../hooks/lib.mjs';

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

// A caller-quoted "phrase" (optionally prefix-suffixed) or one whitespace-delimited word.
const FTS_TOKEN = /"[^"]*"\*?|\S+/g;
// FTS5 boolean operators are recognized ONLY in upper case, so a lowercase `and` is an
// ordinary word and gets quoted like any other. NEAR is deliberately absent: its real form is
// `NEAR(a b, N)`, not an infix, so passing a bare NEAR through would itself be a syntax error.
const FTS_BOOLEAN = new Set(['AND', 'OR', 'NOT']);
const INDEXABLE = /[\p{L}\p{N}]/u;

// The MATCH expression for `q fts` (KIT-T172). User terms used to reach MATCH RAW, so any
// punctuation was parsed as FTS5 SYNTAX: `fts "no ask-first gate"` made SQLite read `first`
// as a column name and die with `no such column: first` — and hyphens are everywhere in
// ticket titles (ask-first, low-poly, file-length). Every user token is now a QUOTED FTS5
// string (internal `"` doubled); FTS5 tokenizes a quoted string as a PHRASE, so `ask-first`
// searches the adjacent pair "ask first" — the intended meaning — instead of injecting an
// operator. Deliberately preserved, because they are the query surface rather than injection:
//   * a trailing `*` — `widget*` becomes `"widget"*`, still a prefix search;
//   * an UPPERCASE AND / OR / NOT, kept as the operator;
//   * a token the caller already quoted, passed through untouched.
// Tokens with nothing indexable are dropped, as are dangling/doubled operators (each is a
// syntax error on its own). An empty query becomes `""`, which matches nothing — the same
// no-false-hits contract ftsOrQuery has.
export function ftsMatchQuery(text) {
  const out = [];
  for (const tok of String(text || '').match(FTS_TOKEN) || []) {
    if (FTS_BOOLEAN.has(tok)) {
      if (out.length && !FTS_BOOLEAN.has(out[out.length - 1])) out.push(tok);
      continue;
    }
    if (tok.startsWith('"')) { out.push(tok); continue; }
    const prefix = tok.endsWith('*');
    const body = (prefix ? tok.slice(0, -1) : tok).replace(/"/g, '""');
    if (!INDEXABLE.test(body)) continue;
    out.push(`"${body}"${prefix ? '*' : ''}`);
  }
  while (out.length && FTS_BOOLEAN.has(out[out.length - 1])) out.pop();
  return out.length ? out.join(' ') : '""';
}

// The id-prefix scope of the project a directory belongs to, or '' outside an adopted repo.
// Walks UP to the nearest ancestor holding .ai/config.yml, so running from a subdirectory
// still resolves to the project's key.
export function defaultScope(root) {
  const dir = storeRoot(resolve(root || process.cwd()));
  return (dir && readIdConfig(dir).key) || '';
}

// `fts [--scope <s>] <query...>` (KIT-T174) — split the scope filter off the free-text query
// in ONE place so the cache and markdown-scan paths filter identically. The cache is
// CROSS-SCOPE by design (every adopted project in one DB), so an unfiltered `fts warp` run
// inside project INV answered with HOD/GG/JV hits and ZERO INV rows — an agent forced onto
// `q` by the store-grep gate reads a screen of other projects' tickets and concludes its own
// project has nothing. Default is therefore the cwd project's scope; `--scope all` (or running
// outside any adopted repo, where there is no key to default to) searches every scope.
export function parseFts(text, root) {
  const toks = String(text || '').match(FTS_TOKEN) || [];
  const terms = [];
  let scope;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '--scope' && i + 1 < toks.length) { scope = toks[++i]; continue; }
    terms.push(toks[i]);
  }
  if (scope === undefined) scope = defaultScope(root);
  return { scope: /^all$/i.test(scope) ? '' : scope, query: terms.join(' ') };
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

// One trail row. Token-frugal: show the node's `summary` (or a clipped title) — the GIST —
// plus a `more` clue (✎ = there's a fuller body to drill into). The agent opens a node's
// full text only when the summary says it needs it (KIT-D028 trail-on-action).
function trailRow(id, node, rel, depth) {
  const isCommit = SHA_SHAPE.test(id);
  const gist = node ? (node.summary || node.title || '') : (isCommit ? '(commit)' : '(not in cache: ' + id + ')');
  const bodyLen = node ? (node.bodyLen ?? (node.body ? node.body.length : 0)) : 0;
  const summaryWasClipped = node && !node.summary && String(node.title || '').length > SUMMARY_CLIP;
  return {
    id,
    store: node ? node.store : (isCommit ? 'commit' : 'missing'),
    rel,
    depth,
    summary: clip(gist, SUMMARY_CLIP),
    more: bodyLen > 0 || summaryWasClipped ? '✎' : '',
  };
}

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
        out.push(trailRow(to, getNode(to), rel, depth + 1));
        next.push([to, depth + 1]);
      }
    }
    frontier = next;
  }
  // Decisions + docs first (the context the agent must see before acting), then by depth/id.
  out.sort((a, b) => storeRank(a.store) - storeRank(b.store) || a.depth - b.depth || compareIds(a.id, b.id));

  // ORIGIN row (KIT-T173): the queried item itself, depth 0, rel `self`, ahead of its
  // ancestors. Without it a trail on an id with NO outbound antecedents — every decision, any
  // freshly-captured ticket — printed "(no results)", which reads as "the store doesn't have
  // this" and sends the agent back to opening files, exactly what the query-gate forbids. The
  // orient banner advertises decision ids, so those ids in particular must be walkable. An id
  // the store genuinely lacks still yields nothing — "(no results)" then means what it says.
  const origin = getNode(startId);
  return origin ? [trailRow(startId, origin, 'self', 0), ...out] : out;
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
