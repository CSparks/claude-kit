// code-index.mjs — the searchable index of a repo and its adopted framework (KIT-T101): file
// content in a trigram FTS table (substring search without scanning the tree), symbols from
// code-index-extract.mjs, kinds code | doc | config | ticket. Machine-local cache under
// ~/.claude/cache/code-index/ (CLAUDE_KIT_CODE_INDEX_DIR overrides). Refreshed incrementally
// by mtime+size on every use; a missing SQLite engine degrades to a walk-and-scan (no index).
//
//   listIndexable(root)          -> [{ rel, abs, size, mtimeMs, kind, lang }]  repo + framework roots
//   refreshIndex(root, opts)     -> { handle, added, changed, removed, total, ms }
//   indexDbPath(root)

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { resolveEngine } from './db-engine.mjs';
import { SKIP_DIRS } from './tree-walk.mjs';
import { frameworkStores } from './q-framework.mjs';
import { classify, extractSymbols } from './code-index-extract.mjs';

const MAX_BYTES = 1_500_000;
const BINARY_PROBE = 4096;
const AI_STORES = ['tickets', 'decisions', 'notes', 'questions', 'inbox'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, lang TEXT NOT NULL,
  mtime REAL NOT NULL, size INTEGER NOT NULL, lines INTEGER NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS content USING fts5(body, tokenize='trigram');
CREATE TABLE IF NOT EXISTS symbols (file_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, line INTEGER NOT NULL, scope TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS symbols_name ON symbols(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS symbols_file ON symbols(file_id);
`;

export function indexDbPath(root) {
  let r = String(root);
  try { r = realpathSync.native(r); } catch { /* keep */ }
  if (process.platform === 'win32') r = r.toLowerCase();
  const key = r.replace(/[:\\/ ]/g, '-').replace(/^-+/, '') || 'root';
  return join(process.env.CLAUDE_KIT_CODE_INDEX_DIR || join(homedir(), '.claude', 'cache', 'code-index'), `${key}.db`);
}

function* walk(abs, rel, isRoot) {
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const childAbs = join(abs, e.name);
    if (e.isFile()) { yield { rel: childRel, abs: childAbs }; continue; }
    if (!e.isDirectory() || e.isSymbolicLink() || e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    if (existsSync(join(childAbs, '.git'))) continue; // another repo: indexed only when it is an adopted framework
    yield* walk(childAbs, childRel, false);
  }
}

function* aiFiles(root, prefix) {
  for (const store of AI_STORES) {
    const dir = join(root, '.ai', store);
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) if (n.endsWith('.md')) yield { rel: `${prefix}.ai/${store}/${n}`, abs: join(dir, n), ticket: true };
  }
}

/** Every indexable file of `root` and of each adopted framework submodule (paths root-relative). */
export function listIndexable(root) {
  const roots = [{ dir: root, prefix: '' }, ...frameworkStores(root).map((f) => ({ dir: dirname(f.aiDir), prefix: `${dirname(f.aiDir).slice(root.length + 1).replace(/\\/g, '/')}/` }))];
  const out = [];
  const seen = new Set();
  for (const r of roots) {
    const files = [...walk(r.dir, '', true), ...aiFiles(r.dir, '')];
    for (const f of files) {
      const rel = r.prefix + f.rel;
      if (seen.has(rel)) continue; // a submodule without its own .git is reached by both roots
      seen.add(rel);
      const cls = f.ticket ? { kind: 'ticket', lang: 'md' } : classify(rel);
      if (!cls) continue;
      let st;
      try { st = statSync(f.abs); } catch { continue; }
      if (st.size > MAX_BYTES) continue;
      out.push({ rel, abs: f.abs, size: st.size, mtimeMs: st.mtimeMs, ...cls });
    }
  }
  return out;
}

const looksBinary = (buf) => buf.subarray(0, BINARY_PROBE).includes(0);

/** Open the cache (or null without an engine), then bring it level with the tree. */
export async function refreshIndex(root, { files = listIndexable(root), dbPath = indexDbPath(root) } = {}) {
  const t0 = Date.now();
  const open = process.env.CLAUDE_KIT_CODE_INDEX_FORCE_SCAN ? null : await resolveEngine();
  if (!open) return { handle: null, files, added: 0, changed: 0, removed: 0, total: files.length, ms: Date.now() - t0 };
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = open(dbPath);
  db.exec(SCHEMA);
  const known = new Map(db.all('SELECT id, path, mtime, size FROM files').map((r) => [r.path, r]));
  const seen = new Set();
  const stale = [];
  for (const f of files) {
    seen.add(f.rel);
    const k = known.get(f.rel);
    if (!k || k.mtime !== f.mtimeMs || k.size !== f.size) stale.push({ f, old: k });
  }
  const gone = [...known.values()].filter((k) => !seen.has(k.path));
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
      const text = buf.toString('utf8');
      db.run('INSERT INTO files (path, kind, lang, mtime, size, lines) VALUES (?, ?, ?, ?, ?, ?)', [f.rel, f.kind, f.lang, f.mtimeMs, f.size, text.split('\n').length]);
      const id = db.all('SELECT id FROM files WHERE path = ?', [f.rel])[0].id;
      db.run('INSERT INTO content (rowid, body) VALUES (?, ?)', [id, text]);
      for (const s of extractSymbols(f.lang, text)) db.run('INSERT INTO symbols VALUES (?, ?, ?, ?, ?)', [id, s.name, s.type, s.line, s.scope]);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { handle: db, files, added, changed, removed: gone.length, total: files.length, ms: Date.now() - t0 };
}

function dropFile(db, id) {
  db.run('DELETE FROM content WHERE rowid = ?', [id]);
  db.run('DELETE FROM symbols WHERE file_id = ?', [id]);
  db.run('DELETE FROM files WHERE id = ?', [id]);
}
