#!/usr/bin/env node
// q.mjs — the query interface over the KIT-T004 cache (the agent-retrieval layer: QUERY
// the cache, don't open files). Canned graph/FTS queries + ad-hoc SQL, compact output.
//
//   node scripts/q.mjs open [scope]                 # open items (todo|doing|review)
//   node scripts/q.mjs children <id>                # items whose parent is <id>
//   node scripts/q.mjs backlinks <id>               # items that link TO <id> (any rel) — walk DOWN
//   node scripts/q.mjs trail <id>                   # walk UP <id>'s ancestry → governing decisions/docs/origin (trail-on-action)
//   node scripts/q.mjs orphans [scope]              # items with NO outbound antecedent link (the provenance lint)
//   node scripts/q.mjs governing <path...>          # OPEN tickets/decisions that GOVERN the given file path(s) (the inverse of trail)
//   node scripts/q.mjs mentions <agent>             # comments @mentioning <agent> across the project, with read (acked) state
//   node scripts/q.mjs drift                        # OPEN items naming a structural target path ABSENT from the tree (decided ≠ actual)
//   node scripts/q.mjs by-commit <sha>              # tickets caused-by / fixed-by <sha>
//   node scripts/q.mjs doc-trail <id>               # history events for <id>, newest first
//   node scripts/q.mjs recent [Nd] [scope]          # time-windowed digest of what happened (KIT-T253)
//   node scripts/q.mjs fts [--scope <s>] <query...> # full-text search title+body
//
// SCOPE (KIT-T255): every [scope] argument defaults to the CWD project; `all` widens to every
// project and an explicit key picks one. Outside an adopted repo there is no key to default
// to, so the default is every project.
//   node scripts/q.mjs similar <title/labels...>    # likely-duplicate ITEMS (dedup, suggest-only)
//   node scripts/q.mjs similar --store <s> <text>   # …confined to one store (tickets|decisions|notes|questions)
//   node scripts/q.mjs next-id <scope> <type>       # O(1) next free id (max(num)+1)
//   node scripts/q.mjs rundown                       # per-scope open-item counts
//   node scripts/q.mjs regressions                   # regression chain data (index-tickets)
//   node scripts/q.mjs supersedes                    # supersede chain data (index-tickets)
//   node scripts/q.mjs integrity                     # orphan parents / dangling links / gaps
//   node scripts/q.mjs sql "SELECT ..."             # ad-hoc read-only SQL
//   node scripts/q.mjs --json <cmd> ...             # machine-readable output
//
// QUERY PATTERNS borrowed from the workflow repo's services + ADAPTED:
//   * `open` mirrors assignments/blockers.service getX(params) — a WHERE-filtered list.
//   * `children`/`backlinks` mirror comments.service's parentId tree walk, generalized to
//     the links graph (upward-stored parent, downward-generated view — KIT-D012).
//   * `doc-trail` mirrors activity.service's per-task timeline (sorted desc).
//   * `next-id`/`integrity` realize KIT-T009's markdown-served logic as O(1) SQL.
//
// MODULES (KIT-T087 file gate): the shared item model + graph walk live in q-model.mjs, the
// file-scoped governance verbs in q-governing.mjs, and the no-engine markdown scan in
// q-fallback.mjs. This file owns cache open/verify, the canned SQL, and the CLI.
//
// FALLBACK: with no DB (or no SQLite engine), every canned query degrades to an in-memory
// markdown scan via db-parse, so an agent/hook still gets answers — the cache is optional.

import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEngine } from './db-engine.mjs';
import { hydrate, defaultDbPath, hydrationSources, isRegisteredStore, isSharedDb } from './hydrate-db.mjs';
import { readIdConfig, statStoreFiles } from './id-utils.mjs';
import { fallback } from './q-fallback.mjs';
import { parseInboxArgs, inboxRows, CONFIRMATION_DAYS } from './q-inbox.mjs';
import {
  OPEN, FTS_LIMIT, ftsOrQuery, ftsMatchQuery, parseSimilar, parseFts, requireStore, requireScope, formatId,
  compareOpen, findGaps, walkAncestry, resolveScope,
} from './q-model.mjs';
import { orphanRows } from './provenance.mjs';
import { resolveStoreRoot } from '../hooks/lib.mjs';
import { recentRows, DEFAULT_DAYS as RECENT_DAYS } from './q-recent.mjs';

const SNIPPET_COL = 2;       // items_fts column index of `body` for snippet()
const SNIPPET_TOKENS = 8;    // words of context around an FTS match

function newestAcross(sources) {
  let newest = 0;
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  for (const s of sources) walk(s.aiDir);
  return newest;
}

// Open the cache, auto-(re)hydrating when it is missing or stale. `root` is undefined for a
// cross-scope query (all registered scopes) and set only when --root forces single-scope;
// staleness is checked against exactly the sources that will be hydrated (KIT-T031). Returns
// { handle, wasStale } — handle is null when no engine exists (caller then uses the markdown
// fallback); wasStale is true when the DB needed rehydration before the query, so callers can
// surface a one-line notice to the user (KIT-T076).
//
// EXPORTED (KIT-T131) as the canonical cache-READ entry: the web-UI API opens the cache
// through this so its reads inherit the SAME staleness→rehydrate guarantee the CLI has —
// never a bespoke open that could serve stale rows.
export async function dbOpen(root, dbPath) {
  const open = await resolveEngine();
  if (!open) return { handle: null, wasStale: false };
  // The shared cache holds REGISTERED projects only (KIT-T164) — an unregistered root may not
  // hydrate into it, so it cannot be represented there and must not be ANSWERED from there
  // either: those rows would be some other project's. Degrade to the markdown scan, which is
  // already q's first-class fail-open path and is exact for a single root.
  if (root && isSharedDb(dbPath) && !isRegisteredStore(root)) {
    return { handle: null, wasStale: false, unregistered: true };
  }
  // Backstop/audit for out-of-band drift (git pull / another machine / parallel session).
  // In-process writes hydrate at the mutation site via writeItemFile — KIT-T096.
  const wasStale = !existsSync(dbPath) || statSync(dbPath).mtimeMs < newestAcross(hydrationSources(root));
  if (wasStale) await hydrate({ root, dbPath });
  return { handle: open(dbPath), wasStale };
}

// ---- q verify (KIT-T076) — per-scope staleness self-check --------------------
// Compare the DB's source_files manifest (what it was hydrated from) against the current
// on-disk stat for every file in each scope's store. Reports each scope as fresh or stale,
// with the manifest delta (added/changed/removed files) as evidence.
// Returns { scopes: [{scope, aiDir, status:'fresh'|'stale', delta:{added,changed,removed}}], stale: bool }.
// Exits 0 when all scopes are fresh, 1 when any scope is stale (script mode).
async function verifyCache(root, dbPath) {
  const open = await resolveEngine();
  if (!open) return { error: 'no-engine', scopes: [], stale: false };
  if (!existsSync(dbPath)) return { error: 'no-db', scopes: [], stale: true };

  const handle = open(dbPath);
  const scopeRows = [];
  try {
    const sources = hydrationSources(root);
    for (const s of sources) {
      const { key } = readIdConfig(s.root, s.aiDir);
      const scope = key || '';
      // On-disk stat (no content reads — the whole point is a cheap check).
      const onDisk = existsSync(s.aiDir) ? statStoreFiles(s.aiDir) : [];
      const byRel = new Map(onDisk.map((e) => [e.relpath, e]));
      // Manifest as hydrated.
      const stored = new Map(
        handle.all('SELECT relpath, mtime, size FROM source_files WHERE scope = ?', [scope])
          .map((r) => [r.relpath, r]),
      );

      const added = [];
      const changed = [];
      for (const e of onDisk) {
        const prev = stored.get(e.relpath);
        if (!prev) { added.push(e.relpath); continue; }
        if (prev.mtime !== e.mtimeMs || prev.size !== e.size) changed.push(e.relpath);
      }
      const removed = [...stored.keys()].filter((r) => !byRel.has(r));
      const isStale = added.length > 0 || changed.length > 0 || removed.length > 0;
      scopeRows.push({ scope, aiDir: s.aiDir, status: isStale ? 'stale' : 'fresh', delta: { added, changed, removed } });
    }
  } finally {
    handle.close();
  }
  const anyStale = scopeRows.some((s) => s.status === 'stale');
  return { scopes: scopeRows, stale: anyStale };
}

// ---- inbox support (KIT-T238) ---------------------------------------------
// Open captures with their body (for a title an id-less cap file has no frontmatter for) and
// the hydrated mtime (the age fallback when a filename carries no date stamp).
function inboxItems(db) {
  return db.all(
    `SELECT i.id, i.scope, i.type, i.title, i.file, f.body, sf.mtime AS mtimeMs
     FROM items i
     LEFT JOIN items_fts f ON f.id = i.id
     LEFT JOIN source_files sf ON sf.relpath = i.file AND sf.scope = i.scope
     WHERE i.store = 'inbox' AND i.archived = 0`);
}

// scope key -> that project's .ai dir, so an inbox row can print an openable path. Built from
// the same hydration sources the cache was filled from; unknown scopes resolve to ''.
function aiDirByScope(root) {
  const byScope = new Map();
  // The cwd project first (it wins any key clash), then every registered project so a
  // cross-scope listing still prints openable paths. Registry read is best-effort.
  let sources = hydrationSources(root);
  try { sources = [...sources, ...hydrationSources(undefined)]; } catch { /* no registry — cwd only */ }
  for (const s of sources) {
    const { key } = readIdConfig(s.root, s.aiDir);
    if (key && !byScope.has(key)) byScope.set(key, s.aiDir);
  }
  return (scope) => byScope.get(scope) || '';
}

// ---- SQLite-backed canned queries -----------------------------------------
// Every scoped verb resolves its [scope] argument through q-model's resolveScope (KIT-T255):
// absent = the cwd project, `all` = every project, a key = that project. The markdown-scan
// fallback resolves through the same helper, so the two paths filter identically.
function cannedQueries(root) {
  const scopeOf = (tok) => resolveScope(tok, root);
  return {
    // The active/drain set EXCLUDES superseded tickets (KIT-T024): a `superseded` status OR
    // any non-archived ticket carrying a `superseded_by` pointer is out — so a forgotten
    // status flip can't leak a retired duplicate back into the drain.
    open: (db, scopeTok) => {
      const scope = scopeOf(scopeTok);
      return db.all(
        `SELECT i.id, i.type, i.status, i.priority, i.title FROM items i
         WHERE i.status IN (${OPEN.map(() => '?').join(',')}) AND i.archived = 0
           AND i.status <> 'superseded'
           AND NOT EXISTS (SELECT 1 FROM links l WHERE l.from_id = i.id AND l.rel = 'superseded_by')
           ${scope ? 'AND i.scope = ?' : ''}`,
        scope ? [...OPEN, scope] : [...OPEN]).sort(compareOpen);
    },

    // The untriaged capture queue (KIT-T238) — the first-class verb the store-grep gate
    // forces traffic onto, so enumerating/ageing the inbox never needs ad-hoc SQL again.
    // `inbox/triaged` is a separate (unindexed) dir, so these rows are open captures only.
    inbox: (db, ...args) => inboxRows(inboxItems(db), { ...parseInboxArgs(args, root), aiDirFor: aiDirByScope(root) }),

    // Captures aged past the confirmation threshold — the same data, one fixed filter.
    confirmations: (db, ...args) => inboxRows(inboxItems(db), {
      ...parseInboxArgs(args, root), olderThanDays: CONFIRMATION_DAYS, aiDirFor: aiDirByScope(root),
    }),

    children: (db, id) => db.all(
      'SELECT id, type, status, title FROM items WHERE parent = ? ORDER BY id', [id]),

    backlinks: (db, id) => db.all(
      `SELECT i.id, i.type, i.status, l.rel, i.title
       FROM links l JOIN items i ON i.id = l.from_id
       WHERE l.to_id = ? ORDER BY l.rel, i.id`, [id]),

    // Commit→ticket cross-ref (KIT-T026): the indexed idx_links_to lookup over the
    // caused_by/fixed_by edges — "which ticket did commit X introduce / which fixed Y".
    'by-commit': (db, sha) => db.all(
      `SELECT i.id, i.type, i.status, l.rel, i.title
       FROM links l JOIN items i ON i.id = l.from_id
       WHERE l.to_id = ? AND l.rel IN ('caused_by','fixed_by') ORDER BY l.rel, i.id`, [sha]),

    'doc-trail': (db, id) => db.all(
      'SELECT ts, event, detail FROM history WHERE item_id = ? ORDER BY ts DESC', [id]),

    // Full-text search over title+body. `--scope` confines the hit set to one project
    // (KIT-T174) and the terms are escaped into an FTS5 phrase expression (KIT-T172) — both
    // parsed in q-model so the markdown-scan fallback filters and matches the same way.
    fts: (db, raw) => {
      const { scope, query } = parseFts(raw, root);
      const params = [SNIPPET_COL, SNIPPET_TOKENS, ftsMatchQuery(query)];
      if (scope) params.push(scope);
      return db.all(
        `SELECT f.id, i.type, i.status, i.title, snippet(items_fts, ?, '[', ']', '…', ?) AS hit
         FROM items_fts f JOIN items i ON i.id = f.id
         WHERE items_fts MATCH ?${scope ? ' AND i.scope = ?' : ''}
         ORDER BY rank LIMIT ?`, [...params, FTS_LIMIT]);
    },

    // Per-scope open counts. `rundown all` is the cross-project board; bare `rundown` answers
    // for the cwd project only, so a per-project glance can't be mistaken for a global one.
    rundown: (db, scopeTok) => {
      const scope = scopeOf(scopeTok);
      return db.all(
        `SELECT scope,
                SUM(status IN ('todo','doing','review')) AS open,
                SUM(status='doing') AS doing,
                SUM(status='review') AS review
         FROM items WHERE archived = 0${scope ? ' AND scope = ?' : ''} GROUP BY scope ORDER BY scope`,
        scope ? [scope] : []);
    },

    // Regression chain data for index-tickets (KIT-T026): every ticket with its upward
    // regressed_from + caused_by/fixed_by commit refs, pulled from the links edges. The
    // indexer assembles the chains; this just serves the per-id provenance from the cache.
    // `scope` confines it to ONE project — the cache is cross-scope, and these rows are
    // written straight into a single project's generated views (KIT-T125).
    regressions: (db, scopeTok) => {
      const scope = scopeOf(scopeTok);
      return db.all(
        `SELECT i.id, i.title,
                rf.to_id AS regressed_from, cb.to_id AS causing_commit, fb.to_id AS fixed_commit
         FROM items i
         LEFT JOIN links rf ON rf.from_id = i.id AND rf.rel = 'regressed_from'
         LEFT JOIN links cb ON cb.from_id = i.id AND cb.rel = 'caused_by'
         LEFT JOIN links fb ON fb.from_id = i.id AND fb.rel = 'fixed_by'
         WHERE i.store = 'tickets'${scope ? ' AND i.scope = ?' : ''} ORDER BY i.id`,
        scope ? [scope] : []);
    },

    // Supersede chain data for index-tickets (KIT-T024): every ticket's outbound supersedes
    // pointer (newer -> the older one it retires). index-tickets assembles older→newer chains
    // from these the same way it builds regression chains from regressed_from. Scoped for the
    // same reason as `regressions` — unscoped, one repo's SUPERSEDED.md listed DUP/GG/KIT/RCN
    // chains it has no relationship to (KIT-T125/KIT-T154).
    supersedes: (db, scopeTok) => {
      const scope = scopeOf(scopeTok);
      return db.all(
        `SELECT i.id, i.status, i.title, s.to_id AS supersedes
         FROM items i
         LEFT JOIN links s ON s.from_id = i.id AND s.rel = 'supersedes'
         WHERE i.store = 'tickets'${scope ? ' AND i.scope = ?' : ''} ORDER BY i.id`,
        scope ? [scope] : []);
    },

    // Dedup detector (KIT-T024, generalized to all stores in KIT-T025): FTS-rank likely
    // duplicates of a free-text proposal, confined to the target store. SUGGEST-ONLY —
    // returns candidates for the operator to link or supersede; never auto-merges. Excludes
    // already-superseded items. Shape matches the markdown-scan fallback (id/type/status/title)
    // so the two are at parity — a dedup hint needs the candidate's id + title, not a snippet.
    similar: (db, raw) => {
      const { store, query } = parseSimilar(raw);
      return db.all(
        `SELECT i.id, i.type, i.status, i.title
         FROM items_fts f JOIN items i ON i.id = f.id
         WHERE items_fts MATCH ? AND i.store = ? AND i.archived = 0
           AND i.status <> 'superseded'
         ORDER BY rank LIMIT ?`, [ftsOrQuery(query), store, FTS_LIMIT]);
    },

    // TRAIL (the trail-on-action rule): walk UP an item's ancestry — parent epic, the
    // decisions/docs/tickets it linked OUT to at inception — and summarize, decisions+docs
    // first. The up-walk surfaces the governing CONTEXT an agent needs before acting; the
    // down-walk (descendants) is `backlinks`/`children`. Load the graph once, walk in JS so
    // the cache + markdown paths share `walkAncestry`.
    trail: (db, id) => {
      const items = db.all('SELECT id, store, type, status, title, summary, body_len AS bodyLen FROM items');
      const links = db.all('SELECT from_id, rel, to_id FROM links');
      const nodeById = new Map(items.map((i) => [i.id, i]));
      const edgesById = new Map();
      for (const l of links) {
        if (!edgesById.has(l.from_id)) edgesById.set(l.from_id, []);
        edgesById.get(l.from_id).push([l.rel, l.to_id]);
      }
      return walkAncestry(id, (x) => edgesById.get(x) || [], (x) => nodeById.get(x));
    },

    // MISSING-ANTECEDENT LINT (KIT-T048 / KIT-D028): open tickets + decisions that point at
    // nothing upstream. The drill-in clue is the id + summary — `q trail <id>` from there.
    orphans: (db, scopeTok) => {
      const items = db.all('SELECT id, scope, store, type, status, priority, title, summary, archived FROM items');
      const links = db.all('SELECT from_id, rel, to_id FROM links');
      const edgesById = new Map();
      for (const l of links) {
        if (!edgesById.has(l.from_id)) edgesById.set(l.from_id, []);
        edgesById.get(l.from_id).push([l.rel, l.to_id]);
      }
      return orphanRows(items, (id) => edgesById.get(id) || [], scopeOf(scopeTok));
    },

    recent: (db, ...args) => recentRows(db, args, root),

    'next-id': (db, scope, type) => {
      const key = requireScope(scope);
      const store = requireStore(type);
      const row = db.all('SELECT MAX(num) AS m FROM items WHERE scope = ? AND store = ?', [key, store])[0];
      const next = (row && row.m ? row.m : 0) + 1;
      return [{ id: formatId(root, key, store, next), scope: key, store, num: next }];
    },

    integrity: (db) => {
      const orphanParents = db.all(
        `SELECT i.id, i.parent FROM items i
         WHERE i.parent IS NOT NULL AND i.parent <> ''
           AND NOT EXISTS (SELECT 1 FROM items p WHERE p.id = i.parent)`);
      const danglingLinks = db.all(
        `SELECT DISTINCT l.from_id, l.rel, l.to_id FROM links l
         WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id = l.to_id)
           AND l.to_id LIKE '%-%' ORDER BY l.from_id`);
      const gaps = findGaps(db.all('SELECT scope, store, num FROM items WHERE num IS NOT NULL'));
      const collisions = db.all(
        'SELECT scope, store, num, COUNT(*) c FROM items WHERE num IS NOT NULL GROUP BY scope, store, num HAVING c > 1');
      return { orphanParents, danglingLinks, gaps, collisions };
    },
  };
}

// ---- output ---------------------------------------------------------------
function printRows(rows, json) {
  if (json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return; }
  if (!rows || (Array.isArray(rows) && !rows.length)) { process.stdout.write('(no results)\n'); return; }
  if (typeof rows === 'object' && !Array.isArray(rows)) {
    for (const [k, v] of Object.entries(rows)) {
      process.stdout.write(`${k}: ${Array.isArray(v) ? v.length : v}\n`);
      if (Array.isArray(v)) for (const r of v) process.stdout.write('  ' + compact(r) + '\n');
    }
    return;
  }
  for (const r of rows) process.stdout.write(compact(r) + '\n');
}
const compact = (r) =>
  typeof r === 'string' ? r : Object.values(r).map((v) => (v === null ? '' : String(v))).join('  ');

// Export verifyCache so tests can assert the manifest diff logic without shelling out.
export { verifyCache };

// Programmatic query surface — the SINGLE entry the process tooling (next-id, survey,
// orient) shares with the CLI, so cache-vs-scan parity lives in ONE place (KIT-T026).
// Runs a canned query against the cache, auto-(re)hydrating, and degrades to the
// db-parse markdown scan when no SQLite engine exists or `noDb` is set — fail-open, the
// cache is never a hard dependency. `root` forces single-scope; `cwdRoot` keys id-format
// (next-id) and seeds the fallback scan. Returns the same rows the CLI prints.
export async function query(cmd, args = [], { root, cwdRoot = root || process.cwd(), noDb = false, dbPath = defaultDbPath() } = {}) {
  // governing/drift/topics are scan-only (the cache schema carries no files/scope/paths/body
  // and no topic column), so
  // route them straight to the markdown scan over cwdRoot regardless of the engine — the
  // fail-open path IS the only path for them. `cached:false` is honest: no SQLite involved.
  if (cmd === 'governing' || cmd === 'drift' || cmd === 'mentions' || cmd === 'topics' || cmd === 'topic') {
    return { rows: fallback(cmd, args, cwdRoot), cached: false };
  }
  const { handle, wasStale } = noDb ? { handle: null, wasStale: false } : await dbOpen(root, dbPath);
  if (!handle) {
    return { rows: fallback(cmd, args, cwdRoot), cached: false };
  }
  // Surface a one-line stale notice so consumers know the DB was rehydrated mid-session
  // (the KIT-T035 incident: stale counts were silently served until a manual re-hydrate).
  if (wasStale) {
    process.stderr.write('q: cache was stale — rehydrated before answering.\n');
  }
  try {
    const Q = cannedQueries(cwdRoot);
    const fn = Q[cmd];
    if (!fn) throw new Error(`unknown query '${cmd}'.`);
    const rows = (cmd === 'fts' || cmd === 'similar') ? fn(handle, args.join(' ')) : fn(handle, ...args);
    return { rows, cached: true, wasStale };
  } finally {
    handle.close();
  }
}

// The full query surface, printed by --help/-h/help. The query-gate block message sends
// agents here ("q.mjs --help — the full query surface"), so this MUST be a working exit-0
// path — it erroring as an unknown query left gate-blocked agents with no discovery route
// (capped 2026-07-05).
const QUERY_SURFACE = `usage: q.mjs [--json] [--no-db] [--root <dir>] <query> [args]

  SCOPE: every [scope] argument defaults to the CWD project — a query answers about the
  repo you are standing in. Pass \`all\` (case-insensitive) for every project, or a project
  key (KIT, ST, …) for that one. Outside an adopted repo there is no key, so the default
  is every project. Applies to: open, inbox, confirmations, orphans, rundown, recent,
  regressions, supersedes, verify, and fts's --scope.

  open [scope]                open items (todo|doing|review)
  inbox [scope] [--older-than Nd]
                              untriaged captures — id, age, scope, type, file path
  confirmations [scope]       captures aged past the confirmation threshold
                              (>= ${CONFIRMATION_DAYS}d — they need a human)
  children <id>               items whose parent is <id>
  backlinks <id>              items that link TO <id> (any rel) — walk DOWN
  trail <id>                  walk UP <id>'s ancestry — governing decisions/docs/origin
  orphans [scope]             open tickets/decisions with NO outbound antecedent link
  governing <path...>         OPEN tickets/decisions that GOVERN the given file path(s)
  mentions <agent>            comments @mentioning <agent> across the project, with read state
  drift                       OPEN items naming a structural target path ABSENT from the tree
  by-commit <sha>             tickets caused-by / fixed-by <sha>
  doc-trail <id>              history events for <id>, newest first
  recent [Nd] [scope]         time-windowed digest (default ${RECENT_DAYS}d): decisions,
                              fixed, status moves, created — counts exact, lists capped
  topics                      the generated topic index — slug, first/last date, count, gist
  topic <slug>                one topic's items, oldest first (also: q --topic <slug>)
  fts [--scope <s>] <q...>    full-text search title+body
  similar [--store <s>] <t>   likely-duplicate items (dedup, suggest-only) — cross-scope
  next-id <scope> <type>      O(1) next free id (max(num)+1)
  rundown [scope]             per-scope open-item counts (\`rundown all\` = every project)
  regressions [scope]         regression chain data (index-tickets)
  supersedes [scope]          supersede chain data (index-tickets)
  integrity                   orphan parents / dangling links / gaps — cross-scope
  sql "SELECT ..."            ad-hoc read-only SQL
  verify [scope]              cache staleness self-check (exit 1 = stale)
  sessions [--project <s>]    list Claude Code terminal sessions, newest first (KIT-T100)
  session <id-prefix>         timestamped conversation dump of one session
  said <words...>             full-text search what was SAID across all sessions
`;

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  // --no-db forces the markdown-scan path (bypass a possibly-stale cache; also proves the
  // fallback works the same as when no SQLite engine is present).
  const noDb = argv.includes('--no-db');
  // --root forces a single-scope hydrate; absent, the cache is cross-scope (all registered
  // projects). `cwdRoot` is the local .ai used only for id-formatting (next-id / config key).
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? argv[ri + 1] : undefined;
  // Same resolution rule as cap/t (KIT-T189): outside every adopted repo the query answers
  // from the unbounded catch-all rather than from nothing.
  const cwdRoot = root || resolveStoreRoot(process.cwd()) || process.cwd();
  const FLAGS = new Set(['--json', '--no-db']);
  const rest = argv.filter((a, i) => !FLAGS.has(a) && a !== '--root' && argv[i - 1] !== '--root');
  // `--topic <slug>` is the flag spelling of the `topic <slug>` verb — the form that reads
  // naturally beside the other retrieval flags (KIT-T189).
  const ti = rest.indexOf('--topic');
  const [cmd, ...args] = ti >= 0 ? ['topic', rest[ti + 1]] : rest;
  if (!cmd) { process.stderr.write(QUERY_SURFACE); process.exit(2); }
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') { process.stdout.write(QUERY_SURFACE); process.exit(0); }

  // Session-transcript queries (KIT-T100) delegate whole: conversation history lives in its
  // own module + its own sessions.db (machine-local, transcript-derived), NOT the work cache.
  if (cmd === 'sessions' || cmd === 'session' || cmd === 'said') {
    const { runSessions } = await import('./q-sessions.mjs');
    process.exit(await runSessions(cmd, args, { json }));
  }

  const dbPath = defaultDbPath();

  if (cmd === 'verify') {
    // `q verify [scope]` — staleness self-check (KIT-T076). Compares the DB manifest
    // against current disk stats; reports per-scope fresh/stale with the delta evidence.
    // Exit 0 = all scopes fresh. Exit 1 = at least one scope stale (or no DB/engine).
    const result = await verifyCache(root, dbPath);
    if (result.error === 'no-engine') {
      process.stderr.write('q verify: no SQLite engine — cannot check manifest (cache is optional).\n');
      process.exit(0);
    }
    if (result.error === 'no-db') {
      process.stdout.write('q verify: no DB found — cache has never been hydrated.\n');
      process.exit(1);
    }
    const filterScope = resolveScope(args[0], cwdRoot);
    const rows = result.scopes.filter((s) => !filterScope || s.scope === filterScope);
    if (json) {
      process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    } else {
      for (const s of rows) {
        const { delta } = s;
        const parts = [];
        if (delta.added.length) parts.push(`+${delta.added.length} added`);
        if (delta.changed.length) parts.push(`~${delta.changed.length} changed`);
        if (delta.removed.length) parts.push(`-${delta.removed.length} removed`);
        const evidence = parts.length ? `  [${parts.join(', ')}]` : '';
        process.stdout.write(`${s.scope}  ${s.status}${evidence}\n`);
        if (s.status === 'stale') {
          for (const f of delta.added) process.stdout.write(`  + ${f}\n`);
          for (const f of delta.changed) process.stdout.write(`  ~ ${f}\n`);
          for (const f of delta.removed) process.stdout.write(`  - ${f}\n`);
        }
      }
    }
    process.exit(result.stale ? 1 : 0);
    return;
  }

  if (cmd === 'sql') {
    const { handle, unregistered } = noDb ? { handle: null } : await dbOpen(root, dbPath);
    if (!handle) {
      process.stderr.write(unregistered
        ? `q: '${root}' is not a registered project — the shared cache holds no rows for it, so ad-hoc SQL has nothing to answer from (KIT-T164).\n`
        : 'q: ad-hoc SQL needs a SQLite engine (none found).\n');
      process.exit(1);
    }
    const sql = args.join(' ');
    if (!/^\s*(select|with|pragma|explain)\b/i.test(sql)) { process.stderr.write('q: only read-only SQL (SELECT/WITH/PRAGMA/EXPLAIN) — the cache is never written back.\n'); handle.close(); process.exit(1); }
    printRows(handle.all(sql), json);
    handle.close();
    return;
  }

  const { rows } = await query(cmd, args, { root, cwdRoot, noDb, dbPath });
  printRows(rows, json);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write('q: ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
  });
}
