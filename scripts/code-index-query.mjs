// code-index-query.mjs — the q verbs over the code index (KIT-T101): `q code` (content, the grep
// replacement), `q sym` (defs, impls, uses, mods), `q file` (paths). Every content hit is
// VERIFIED against the file text held in the index (current after every refresh), so an answer
// is exactly what grep would print: the trigram table only narrows candidate files. Flags: see QUERY_HELP in q.mjs.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { refreshIndex } from './code-index.mjs';
import { projectRepo } from './q-project.mjs';

export const DEFAULT_LIMIT = 40;
const MIN_LITERAL = 3;
const LINE_CLIP = 160;
const UNRANKED = 9;
const GAP = '\u0000';
const DEFAULT_KINDS = ['code', 'doc', 'config'];
const ALL_KINDS = [...DEFAULT_KINDS, 'ticket'];
const TYPE_RANK = { fn: 0, struct: 1, enum: 1, trait: 1, class: 1, type: 1, const: 2, var: 2, macro: 2, mod: 3, impl: 4, use: 5, heading: 6, section: 6 };
const VALUE_FLAGS = new Set(['--kind', '--lang', '--path', '--type', '--limit', '--project', '-C', '-A', '-B']);

const ATTACHED_COUNT = /^-([ABC])(\d+)$/;
const ATTACHED_VALUE = /^(--(?:kind|lang|path|type|limit|project))=(.*)$/;

// `-B2` and `--lang=rust` mean `-B 2` and `--lang rust`, as in grep.
const splitAttached = (args) => args.flatMap((a) => {
  const m = ATTACHED_COUNT.exec(String(a)) || ATTACHED_VALUE.exec(String(a));
  return m ? [m[1].startsWith('--') ? m[1] : `-${m[1]}`, m[2]] : [a];
});

// In --regex mode a pattern whose only alternation is grep's `\|` means alternation (a JS `\|`
// is a literal pipe, which an agent writing `a\|b` never wants); a pattern with a bare `|` is left alone.
export function breAlternation(text) {
  let bare = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { if (text[i + 1] === '|') escaped = true; i++; } else if (text[i] === '|') bare = true;
  }
  return escaped && !bare ? text.replace(/\\\|/g, '|') : text;
}

/** Split argv-style tokens into { text, flags }. */
export function parseCodeArgs(rawArgs) {
  const args = splitAttached(rawArgs);
  const flags = { before: 0, after: 0, limit: DEFAULT_LIMIT, kinds: null, types: null, unknown: [] };
  const words = [];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (VALUE_FLAGS.has(a)) {
      const v = args[++i];
      if (a === '--kind') flags.kinds = String(v).split(',');
      else if (a === '--type') flags.types = String(v).split(',');
      else if (a === '--lang') flags.lang = String(v);
      else if (a === '--path') flags.path = String(v).replace(/\\/g, '/').replace(/^\.\//, '');
      else if (a === '--project') flags.project = String(v);
      else if (a === '--limit') flags.limit = Number(v);
      else if (a === '-C') { flags.before = Number(v) || 0; flags.after = Number(v) || 0; }
      else if (a === '-A') flags.after = Number(v) || 0;
      else if (a === '-B') flags.before = Number(v) || 0;
    } else if (a === '--regex' || a === '-E') flags.regex = true;
    else if (a === '-i') flags.ignoreCase = true;
    else if (a === '-w') flags.word = true;
    else if (a === '--fuzzy') flags.fuzzy = true;
    else if (a === '--exact') flags.fuzzy = false;
    else if (a === '-l') flags.filesOnly = true;
    else if (a === '-c') flags.count = true;
    else if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) flags.unknown.push(a);
    else words.push(a);
  }
  const text = words.join(' ');
  return { text: flags.regex ? breAlternation(text) : text, flags };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Line matcher for the query, or null when the regex does not compile. */
export function buildMatcher(text, flags) {
  try {
    if (flags.fuzzy && !flags.regex) {
      const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
      return (line) => { const l = line.toLowerCase(); return terms.every((t) => l.includes(t)); };
    }
    let src = flags.regex ? text : escapeRe(text);
    if (flags.word) src = `\\b(?:${src})\\b`;
    const re = new RegExp(src, flags.ignoreCase ? 'i' : '');
    return (line) => re.test(line);
  } catch {
    return null;
  }
}

// Top-level alternation branches of a regex with group/class/escape content blanked, so the
// remaining characters are exactly the literal material a prefilter may rely on.
function regexBranches(text) {
  const branches = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') { cur += GAP + GAP; i++; continue; }
    if (ch === '(' || ch === '[') { depth++; cur += GAP; continue; }
    if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); cur += GAP; continue; }
    if (ch === '|' && depth === 0) { branches.push(cur); cur = ''; continue; }
    cur += depth ? GAP : ch;
  }
  branches.push(cur);
  return branches;
}

function longestRun(branch) {
  const runs = [];
  let run = '';
  for (let i = 0; i < branch.length; i++) {
    const c = branch[i];
    const quantified = '?*{'.includes(branch[i + 1] || ' ');
    if (/[A-Za-z0-9_]/.test(c) && !quantified) { run += c; continue; }
    if (run) runs.push(run);
    run = '';
  }
  if (run) runs.push(run);
  return runs.sort((a, z) => z.length - a.length)[0] || '';
}

/**
 * Trigram prefilter { mode: 'and'|'or', terms } of literals every matching line must contain,
 * or null when none can be proven (then every filtered file is a candidate). It may only ever
 * ADD candidates, never drop a true match.
 */
export function prefilter(text, flags) {
  if (flags.fuzzy && !flags.regex) {
    const terms = text.split(/\s+/).filter((t) => t.length >= MIN_LITERAL);
    return terms.length ? { mode: 'and', terms } : null;
  }
  if (!flags.regex) return text.length >= MIN_LITERAL && !text.includes('\n') ? { mode: 'and', terms: [text] } : null;
  const terms = [];
  for (const b of regexBranches(text)) {
    const best = longestRun(b);
    if (best.length < MIN_LITERAL) return null;
    terms.push(best);
  }
  return { mode: terms.length > 1 ? 'or' : 'and', terms };
}

const ftsExpr = ({ mode, terms }) => terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(mode === 'or' ? ' OR ' : ' AND ');
const dirPrefix = (p) => p.replace(/\/?$/, '/');

function sqlFilters(flags, kinds) {
  const where = [`f.kind IN (${kinds.map(() => '?').join(',')})`];
  const params = [...kinds];
  if (flags.lang) { where.push('f.lang = ?'); params.push(flags.lang); }
  if (flags.path) {
    where.push("(f.path = ? OR f.path LIKE ? ESCAPE '\\')");
    params.push(flags.path, dirPrefix(flags.path).replace(/[%_\\]/g, '\\$&') + '%');
  }
  return { where, params };
}

const memFilter = (files, flags, kinds) => files.filter((f) => kinds.includes(f.kind) && (!flags.lang || f.lang === flags.lang)
  && (!flags.path || f.rel === flags.path || f.rel.startsWith(dirPrefix(flags.path))));

const byName = new Intl.Collator().compare; // same order as String#localeCompare, without its per-call setup cost
// The newline ending a file starts no line.
function splitLines(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const clip = (s) => (s.length > LINE_CLIP ? s.slice(0, LINE_CLIP - 1) + '…' : s);

async function candidatesFor(idx, text, flags, kinds) {
  if (!idx.handle) return memFilter(idx.files, flags, kinds).map((f) => ({ path: f.rel }));
  const pre = prefilter(text, flags);
  const { where, params } = sqlFilters(flags, kinds);
  const sql = pre
    ? `SELECT f.path, c.body FROM content c JOIN files f ON f.id = c.rowid WHERE content MATCH ? AND ${where.join(' AND ')}`
    : `SELECT f.path, c.body FROM files f JOIN content c ON c.rowid = f.id WHERE ${where.join(' AND ')}`;
  return idx.handle.all(sql, pre ? [ftsExpr(pre), ...params] : params);
}

async function codeVerb(root, text, flags, refresh) {
  const matcher = buildMatcher(text, flags);
  if (!matcher) return [{ loc: '', text: `invalid pattern: ${text}` }];
  const kinds = flags.kinds || DEFAULT_KINDS;
  const idx = await refresh(root, { tickets: kinds.includes('ticket') });
  const candidates = await candidatesFor(idx, text, flags, kinds);
  const abs = idx.handle ? null : new Map(idx.files.map((f) => [f.rel, f.abs]));
  const perFile = [];
  for (const c of candidates) {
    let body;
    try { body = c.body ?? readFileSync(abs.get(c.path), 'utf8'); } catch { continue; }
    const hits = [];
    splitLines(body).forEach((l, i) => { if (matcher(l)) hits.push(i); });
    if (hits.length) perFile.push({ path: c.path, text: body, hits });
  }
  const defLines = new Set();
  if (idx.handle && /^[A-Za-z_]\w*$/.test(text) && !flags.regex) {
    const defs = idx.handle.all("SELECT f.path, s.line FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.name = ? AND s.type NOT IN ('use','impl')", [text]);
    for (const r of defs) defLines.add(`${r.path}:${r.line}`);
  }
  idx.handle?.close();
  if (defLines.size) for (const f of perFile) f.rank = f.hits.some((i) => defLines.has(`${f.path}:${i + 1}`)) ? 0 : 1;
  const rank = (f) => f.rank ?? 1;
  perFile.sort((a, b) => rank(a) - rank(b) || b.hits.length - a.hits.length || byName(a.path, b.path));
  if (flags.filesOnly || flags.count) return perFile.map((f) => ({ loc: f.path, text: flags.count ? String(f.hits.length) : `${f.hits.length} hit(s)` }));
  return renderHits(perFile, flags);
}

function renderHits(perFile, flags) {
  const rows = [];
  let shown = 0;
  let total = 0;
  for (const f of perFile) {
    total += f.hits.length;
    if (flags.limit && shown >= flags.limit) continue;
    const lines = splitLines(f.text);
    const emitted = new Set();
    for (const i of f.hits) {
      if (flags.limit && shown >= flags.limit) continue;
      shown++;
      for (let j = Math.max(0, i - flags.before); j <= Math.min(lines.length - 1, i + flags.after); j++) {
        if (emitted.has(j)) continue;
        emitted.add(j);
        rows.push({ loc: `${f.path}${j === i ? ':' : '-'}${j + 1}`, text: clip(lines[j].trimEnd()) });
      }
    }
  }
  if (flags.limit && total > shown) rows.push({ loc: '', text: `+${total - shown} more hit(s) in ${perFile.length} file(s) — --limit 0 for all` });
  return rows;
}

async function symVerb(root, text, flags, refresh) {
  const kinds = flags.kinds || DEFAULT_KINDS;
  const idx = await refresh(root, { tickets: kinds.includes('ticket') });
  if (!idx.handle) return [{ loc: '', text: 'q sym needs a SQLite engine (none found)' }];
  const { where, params } = sqlFilters(flags, kinds);
  if (text && flags.fuzzy) { where.push("s.name LIKE ? ESCAPE '\\'"); params.push(`%${text.replace(/[%_\\]/g, '\\$&')}%`); }
  else if (text) { where.push('s.name = ?'); params.push(text); }
  if (flags.types) { where.push(`s.type IN (${flags.types.map(() => '?').join(',')})`); params.push(...flags.types); }
  const rows = idx.handle.all(`SELECT f.path, s.line, s.type, s.name, s.scope FROM symbols s JOIN files f ON f.id = s.file_id WHERE ${where.join(' AND ')}`, params);
  idx.handle.close();
  rows.sort((a, b) => (TYPE_RANK[a.type] ?? UNRANKED) - (TYPE_RANK[b.type] ?? UNRANKED) || a.path.localeCompare(b.path) || a.line - b.line);
  const cut = flags.limit ? rows.slice(0, flags.limit) : rows;
  const out = cut.map((r) => ({ loc: `${r.path}:${r.line}`, type: r.type, name: r.name, scope: r.scope }));
  if (flags.limit && rows.length > cut.length) out.push({ loc: '', type: '', name: `+${rows.length - cut.length} more — --limit 0 for all`, scope: '' });
  return out;
}

async function fileVerb(root, text, flags, refresh) {
  const idx = await refresh(root);
  idx.handle?.close();
  const isGlob = /[*?]/.test(text);
  const re = isGlob
    ? new RegExp(`^${[...text].map((c) => (c === '*' ? '.*' : c === '?' ? '.' : escapeRe(c))).join('')}$`, 'i')
    : new RegExp(escapeRe(text), 'i');
  const rows = memFilter(idx.files, flags, flags.kinds || ALL_KINDS).filter((f) => re.test(f.rel) || re.test(f.rel.slice(f.rel.lastIndexOf("/") + 1)))
    .sort((a, b) => a.rel.length - b.rel.length || a.rel.localeCompare(b.rel));
  const cut = flags.limit ? rows.slice(0, flags.limit) : rows;
  const out = cut.map((f) => ({ loc: f.rel, kind: f.kind, lang: f.lang }));
  if (flags.limit && rows.length > cut.length) out.push({ loc: '', kind: '', lang: `+${rows.length - cut.length} more — --limit 0 for all` });
  return out;
}

const DEF_TERM = /[a-z][a-z\d]*/g;
const DEF_STOP_TYPES = ['use', 'impl', 'heading', 'section'];
const DEF_HIT_LIMIT = 5;
const DEF_MIN_TERM = 3;
const nameWords = (name) => name.replace(/([a-z\d])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z\d]+/).filter(Boolean);

/**
 * Definitions in code whose name is, or contains as a camel/snake word, a term of an `fts` query:
 * the "also in code" rows. Ranked by exact name, then how rare the matched term is among
 * definitions (a generic word like "layer" yields to a specific one like "bevel"), terms matched,
 * symbol type; at most DEF_HIT_LIMIT. Empty when no term qualifies, no SQLite engine, or the index cannot refresh.
 */
export async function ftsCodeDefs(queryText, root, refresh = refreshIndex) {
  const terms = [...new Set(String(queryText || '').replace(/\b(?:AND|OR|NOT)\b/g, ' ').toLowerCase().match(DEF_TERM) || [])]
    .filter((t) => t.length >= DEF_MIN_TERM);
  if (!terms.length) return [];
  let idx;
  try { idx = await refresh(root, { tickets: false }); } catch { return []; }
  if (!idx.handle) return [];
  const like = terms.map(() => 's.name LIKE ?').join(' OR ');
  const found = idx.handle.all(
    `SELECT f.path, s.line, s.type, s.name, s.scope FROM symbols s JOIN files f ON f.id = s.file_id
     WHERE f.kind = 'code' AND s.type NOT IN (${DEF_STOP_TYPES.map(() => '?').join(',')}) AND (${like})`,
    [...DEF_STOP_TYPES, ...terms.map((t) => `%${t}%`)]);
  idx.handle.close();
  const hits = found
    .map((r) => ({ ...r, matched: terms.filter((t) => nameWords(r.name).includes(t)) }))
    .filter((r) => r.matched.length);
  const termCount = new Map(terms.map((t) => [t, hits.filter((r) => r.matched.includes(t)).length]));
  const rarest = (r) => Math.min(...r.matched.map((t) => termCount.get(t)));
  const exact = (r) => (terms.includes(r.name.toLowerCase()) ? 0 : 1);
  return hits
    .sort((a, b) => exact(a) - exact(b) || rarest(a) - rarest(b) || b.matched.length - a.matched.length
      || (TYPE_RANK[a.type] ?? UNRANKED) - (TYPE_RANK[b.type] ?? UNRANKED) || a.path.localeCompare(b.path) || a.line - b.line)
    .slice(0, DEF_HIT_LIMIT)
    .map((r) => ({ loc: `${r.path}:${r.line}`, type: r.type, name: r.name, scope: r.scope }));
}

// An option the verb does not take is a gap in q: file it (KIT-T286) instead of letting grep win.
async function unknownFlagRows(cmd, args, unknown, root) {
  const { reportGap } = await import('./q-gap.mjs');
  const gap = reportGap({ shape: `flag:${cmd}:${unknown[0]}`, title: `'${cmd}' has no ${unknown[0]} flag`, detail: `q ${cmd} ${args.join(' ')}`, project: basename(root) });
  return [{ loc: '', text: `q ${cmd} does not take ${unknown.join(' ')}.${gap ? ` Filed as ${gap.id} (kit-bug) — do not fall back to grep.` : ''}` }];
}

/**
 * Entry for q.mjs: cmd is 'code' | 'sym' | 'file'. `refresh(root, { tickets })` yields the index
 * to answer from (default refreshIndex; the resident server passes its own).
 */
export async function codeVerbRows(cmd, args, root, refresh = refreshIndex) {
  const { text, flags } = parseCodeArgs(args);
  if (flags.unknown.length) return unknownFlagRows(cmd, args, flags.unknown, root);
  if (flags.project !== undefined) {
    root = projectRepo(flags.project);
    refresh = refreshIndex;
  }
  if (cmd === 'code') return text ? codeVerb(root, text, flags, refresh) : [{ loc: '', text: 'usage: q code <text> [--regex] [-i] [-w] [--lang L] [--path P] [-C n]' }];
  if (cmd === 'sym') return symVerb(root, text, flags, refresh);
  return text ? fileVerb(root, text, flags, refresh) : [{ loc: '', text: 'usage: q file <substring|glob>' }];
}
