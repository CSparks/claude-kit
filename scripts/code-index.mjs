// code-index.mjs — the searchable index of a repo and its adopted framework (KIT-T101): file
// content in a trigram FTS table (substring search without scanning the tree), symbols from
// code-index-extract.mjs, kinds code | doc | config | ticket. Machine-local cache under
// ~/.claude/cache/code-index/ (CLAUDE_KIT_CODE_INDEX_DIR overrides).
//
// Refresh is incremental. With git available a warm call asks git what changed (one status per
// root, KIT-T289) and re-reads only those files; otherwise it re-lists the tree and compares
// mtime+size. A missing SQLite engine degrades to scanning the listed files (no index).

import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveEngine } from './db-engine.mjs';
import { cacheDir } from './q-server-proto.mjs';
import { extractSymbols } from './code-index-extract.mjs';
import { aiPaths, changedPaths, describe, gitStates, indexRoots, listIndexable } from './code-index-source.mjs';

export { listIndexable };

const BINARY_PROBE = 4096;
const META_KEY = 'git';

const SCHEMA = `
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, lang TEXT NOT NULL,
  mtime REAL NOT NULL, size INTEGER NOT NULL, lines INTEGER NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS content USING fts5(body, tokenize='trigram');
CREATE TABLE IF NOT EXISTS symbols (file_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, line INTEGER NOT NULL, scope TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS symbols_name ON symbols(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS symbols_file ON symbols(file_id);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export function indexDbPath(root) {
  let r = String(root);
  try { r = realpathSync.native(r); } catch { /* keep */ }
  if (process.platform === 'win32') r = r.toLowerCase();
  const key = r.replace(/[:\\/ ]/g, '-').replace(/^-+/, '') || 'root';
  return join(cacheDir(), `${key}.db`);
}

const looksBinary = (buf) => buf.subarray(0, BINARY_PROBE).includes(0);
const differs = (known, rec) => !known || known.mtime !== rec.mtimeMs || known.size !== rec.size;

function dropFile(db, id) {
  db.run('DELETE FROM content WHERE rowid = ?', [id]);
  db.run('DELETE FROM symbols WHERE file_id = ?', [id]);
  db.run('DELETE FROM files WHERE id = ?', [id]);
}

function insertFile(db, f, text) {
  db.run('INSERT INTO files (path, kind, lang, mtime, size, lines) VALUES (?, ?, ?, ?, ?, ?)', [f.rel, f.kind, f.lang, f.mtimeMs, f.size, text.split('\n').length]);
  const id = db.all('SELECT id FROM files WHERE path = ?', [f.rel])[0].id;
  db.run('INSERT INTO content (rowid, body) VALUES (?, ?)', [id, text]);
  for (const s of extractSymbols(f.lang, text)) db.run('INSERT INTO symbols VALUES (?, ?, ?, ?, ?)', [id, s.name, s.type, s.line, s.scope]);
}

// Apply `stale` [{ f, old }] and `gone` [row] in one transaction; returns the counts.
function apply(db, stale, gone, state) {
  let added = 0;
  let changed = 0;
  db.exec('BEGIN');
  try {
    for (const k of gone) dropFile(db, k.id);
    for (const { f, old } of stale) {
      let buf;
      try { buf = readFileSync(f.abs); } catch { continue; }
      if (looksBinary(buf)) continue;
      if (old) { dropFile(db, old.id); changed++; } else added++;
      insertFile(db, f, buf.toString('utf8'));
    }
    if (state) db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [META_KEY, JSON.stringify(state)]);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { added, changed, removed: gone.length };
}

function fullSync(db, files) {
  const known = new Map(db.all('SELECT id, path, mtime, size FROM files').map((r) => [r.path, r]));
  const seen = new Set(files.map((f) => f.rel));
  const stale = files.filter((f) => differs(known.get(f.rel), f)).map((f) => ({ f, old: known.get(f.rel) }));
  return { stale, gone: [...known.values()].filter((k) => !seen.has(k.path)) };
}

// The warm path: re-check only what git says moved, plus the work-store items (not in git).
function gitSync(db, root, roots, prev, cur, tickets) {
  const paths = changedPaths(roots, prev, cur);
  if (!paths) return null;
  const rows = db.all('SELECT id, path, kind, lang, mtime, size FROM files');
  const byPath = new Map(rows.map((k) => [k.path, k]));
  const ai = new Set(tickets ? roots.flatMap((r) => aiPaths(r.dir, r.prefix)) : []);
  for (const p of ai) paths.add(p);
  const stale = [];
  const gone = [];
  for (const rel of paths) {
    const row = byPath.get(rel);
    const rec = describe(root, rel);
    if (rec) { if (differs(row, rec)) stale.push({ f: rec, old: row }); } else if (row) gone.push(row);
  }
  if (tickets) for (const k of rows) if (k.kind === 'ticket' && !ai.has(k.path) && !gone.includes(k)) gone.push(k);
  return { stale, gone, rows };
}

const toFiles = (rows, root) => rows.map((r) => ({ rel: r.path, abs: join(root, r.path), kind: r.kind, lang: r.lang }));
const filesFromDb = (db, root) => toFiles(db.all('SELECT path, kind, lang FROM files'), root);

/** Open the cache once and set its schema: a handle the resident server keeps and passes as `db`. */
export async function openIndex(root, dbPath = indexDbPath(root)) {
  const open = process.env.CLAUDE_KIT_CODE_INDEX_FORCE_SCAN ? null : await resolveEngine();
  if (!open) return null;
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = open(dbPath);
  db.exec(SCHEMA);
  return db;
}

/**
 * Bring the cache level with the tree: { handle, files, added, … }; handle is null without an
 * engine. `tickets: false` skips re-checking the work-store items (a stat per ticket) for
 * queries that never read them. A caller-held `db` (openIndex) stays open: the returned handle's
 * close() is then a no-op.
 */
export async function refreshIndex(root, { files, dbPath = indexDbPath(root), tickets = true, db: held } = {}) {
  const t0 = Date.now();
  const db = held || await openIndex(root, dbPath);
  if (!db) {
    const listed = files || listIndexable(root);
    return { handle: null, files: listed, added: 0, changed: 0, removed: 0, total: listed.length, ms: Date.now() - t0 };
  }
  const roots = indexRoots(root);
  const cur = files ? null : await gitStates(roots);
  const prevRow = cur && db.all('SELECT value FROM meta WHERE key = ?', [META_KEY])[0];
  let plan = prevRow ? gitSync(db, root, roots, JSON.parse(prevRow.value), cur, tickets) : null;
  let listed = files;
  if (!plan) {
    listed = files || listIndexable(root);
    plan = fullSync(db, listed);
  }
  const same = prevRow && prevRow.value === JSON.stringify(cur);
  const counts = !plan.stale.length && !plan.gone.length && same ? { added: 0, changed: 0, removed: 0 } : apply(db, plan.stale, plan.gone, cur);
  const unchanged = !counts.added && !counts.changed && !counts.removed;
  const all = listed || (unchanged && plan.rows ? toFiles(plan.rows, root) : filesFromDb(db, root));
  const handle = held ? { ...db, close() {} } : db;
  return { handle, files: all, ...counts, total: all.length, ms: Date.now() - t0 };
}
