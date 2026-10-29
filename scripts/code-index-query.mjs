// code-index-query.mjs — the q verbs over the code index (KIT-T101): `q code` (content, the grep
// replacement), `q sym` (defs, impls, uses, mods), `q file` (paths). Every content hit is
// VERIFIED against the file text held in the index (current after every refresh), so an answer
// is exactly what grep would print: the trigram table only narrows candidate files. Flags: see QUERY_HELP in q.mjs.

import { existsSync, readFileSync } from 'node:fs';
import { extractSymbols, langOfToken } from './code-index-extract.mjs';
import { basename, isAbsolute, relative } from 'node:path';
import { refreshIndex } from './code-index.mjs';
import { projectRepo } from './q-project.mjs';
import { dirIndex } from './q-scan-dir.mjs';
import { uncheckedFrameworks } from './q-framework.mjs';
import { globToRegExp } from '../hooks/lib/exclusions.mjs';

export const DEFAULT_LIMIT = 40;
const MIN_LITERAL = 3;
const DOC_LINE_LIMIT = 5;
const LINE_CLIP = 160;
const UNRANKED = 9;
const GAP = '\u0000';
const DEFAULT_KINDS = ['code', 'doc', 'config'];
const ALL_KINDS = [...DEFAULT_KINDS, 'ticket'];
const TYPE_RANK = { fn: 0, struct: 1, enum: 1, trait: 1, class: 1, type: 1, const: 2, var: 2, macro: 2, mod: 3, impl: 4, use: 5, heading: 6, section: 6 };
const VALUE_FLAGS = new Set(['--kind', '--lang', '--path', '--not-path', '--type', '--limit', '--project', '--dir', '-C', '-A', '-B']);

// grep habits whose behaviour q has always: line numbers are shown, the walk is recursive, paths are printed.
const GREP_NOOP_FLAGS = new Set(['-n', '--line-number', '-r', '-R', '--recursive', '-H', '--with-filename', '--no-heading', '--color=never', '-s']);

const ATTACHED_COUNT = /^-([ABC])(\d+)$/;
const ATTACHED_VALUE = /^(--(?:kind|lang|path|not-path|type|limit|project|dir))=(.*)$/;

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
  const flags = { before: 0, after: 0, limit: DEFAULT_LIMIT, kinds: null, types: null, notPaths: [], unknown: [] };
  const words = [];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (VALUE_FLAGS.has(a)) {
      const v = args[++i];
      if (a === '--kind') flags.kinds = String(v).split(',');
      else if (a === '--type') flags.types = String(v).split(',');
      else if (a === '--lang') flags.langs = String(v).split(',').map(langOfToken);
      else if (a === '--path') flags.path = String(v).replace(/\\/g, '/').replace(/^\.\//, '');
      else if (a === '--not-path') flags.notPaths.push(String(v).replace(/\\/g, '/').replace(/^\.\//, ''));
      else if (a === '--project') flags.project = String(v);
      else if (a === '--dir') flags.dir = String(v);
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
    else if (a === '-o') flags.only = true;
    else if (a === '-c') flags.count = true;
    else if (GREP_NOOP_FLAGS.has(a)) continue;
    else if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) flags.unknown.push(a);
    else words.push(a);
  }
  const text = words.join(' ');
  return { text: flags.regex ? breAlternation(text) : text, flags };
}

const isAbsolutePath = (path) => isAbsolute(path) || /^[A-Za-z]:\//.test(path);

// `--path D:/dev/repo/crates/x` names the same place as `--path crates/x` from inside the repo.
function repoRelative(root, path) {
  if (!isAbsolutePath(path)) return path;
  const rel = relative(root, path).replace(/\\/g, '/');
  return rel.startsWith('..') || isAbsolute(rel) ? path : rel;
}

// An absolute `--path` outside the repo is a directory the index does not cover: scan it as `--dir` (KIT-T707).
function outsideIndex(flags, root) {
  return flags.dir === undefined && flags.path && isAbsolutePath(flags.path) && repoRelative(root, flags.path) === flags.path;
}

const escapeRe = (s) =>s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

/** Matched substrings of a line (rg -o), or null when the pattern does not compile. */
export function buildExtractor(text, flags) {
  try {
    if (flags.fuzzy && !flags.regex) {
      const terms = text.split(/s+/).filter(Boolean).map(escapeRe);
      const re = new RegExp(terms.join('|'), 'gi');
      return (line) => line.match(re) || [];
    }
    let src = flags.regex ? text : escapeRe(text);
    if (flags.word) src = `\b(?:${src})\b`;
    const re = new RegExp(src, flags.ignoreCase ? 'gi' : 'g');
    return (line) => [...line.matchAll(re)].map((m) => m[0]).filter(Boolean);
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
  if (flags.langs) { where.push(`f.lang IN (${flags.langs.map(() => '?').join(',')})`); params.push(...flags.langs); }
  if (flags.path) {
    where.push("(f.path = ? OR f.path LIKE ? ESCAPE '\\')");
    params.push(flags.path, dirPrefix(flags.path).replace(/[%_\\]/g, '\\$&') + '%');
  }
  return { where, params };
}

// --not-path drops a path: a glob (`**/tests/**`, `*_test.rs`; a glob with no `/` also matches the file name) or a plain directory/file prefix.
const excluder = (flags) => {
  const tests = flags.notPaths.map((p) => {
    if (/[*?]/.test(p)) {
      const re = globToRegExp(p);
      return (rel) => re.test(rel) || (!p.includes('/') && re.test(rel.slice(rel.lastIndexOf('/') + 1)));
    }
    return (rel) => rel === p || rel.startsWith(dirPrefix(p));
  });
  return (rel) => tests.some((t) => t(rel));
};

const memFilter = (files, flags, kinds) => {
  const dropped = excluder(flags);
  return files.filter((f) => kinds.includes(f.kind) && (!flags.langs || flags.langs.includes(f.lang))
    && (!flags.path || f.rel === flags.path || f.rel.startsWith(dirPrefix(flags.path))) && !dropped(f.rel));
};

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
  const dropped = excluder(flags);
  const candidates = (await candidatesFor(idx, text, flags, kinds)).filter((c) => !dropped(c.path));
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
  if (!perFile.length) return emptyResult(root, text, flags, refresh, memFilter(idx.files, flags, kinds).length);
  if (defLines.size) for (const f of perFile) f.rank = f.hits.some((i) => defLines.has(`${f.path}:${i + 1}`)) ? 0 : 1;
  const rank = (f) => f.rank ?? 1;
  perFile.sort((a, b) => rank(a) - rank(b) || b.hits.length - a.hits.length || byName(a.path, b.path));
  if (flags.filesOnly || flags.count) return perFile.map((f) => ({ loc: f.path, text: flags.count ? String(f.hits.length) : `${f.hits.length} hit(s)` }));
  return renderHits(perFile, flags, flags.only ? buildExtractor(text, flags) : null);
}

// Alternatives of a grep-style pattern typed without --regex (`a\|b`, `a|b`), or null.
const pipeAlternatives = (text) => {
  const parts = text.split(/\\?\|/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : null;
};

// A search that found nothing says why: a `|` pattern read literally is retried as alternatives
// (grep habit), and an empty filter set is named, so neither sends the caller to grep.
async function emptyResult(root, text, flags, refresh, filtered) {
  const parts = !flags.regex && !flags.fuzzy && pipeAlternatives(text);
  if (parts) {
    const rows = await codeVerb(root, parts.map(escapeRe).join('|'), { ...flags, regex: true }, refresh);
    if (rows.length) return [{ loc: '', text: `no literal "${text}"; matched as ${parts.length} alternatives (--regex)` }, ...rows];
  }
  if (!filtered) return [{ loc: '', text: `(no results: no indexed file passes ${filterSummary(flags)})` }];
  return [];
}

const filterSummary = (flags) => [flags.path && `--path ${flags.path}`, flags.langs && `--lang ${flags.langs.join(',')}`, flags.kinds && `--kind ${flags.kinds.join(',')}`]
  .filter(Boolean).join(' ') || 'the default kinds';

/**
 * Doc and config lines holding every term of an `fts` query (case-insensitive), at most
 * DOC_LINE_LIMIT: the "also in docs/config" rows. Empty when no term is searchable.
 */
export async function ftsDocLines(queryText, root, refresh = refreshIndex) {
  const terms = String(queryText || '').split(/\s+/).map((t) => t.replace(/\*$/, '')).filter((t) => t.length >= MIN_LITERAL && !/^(?:AND|OR|NOT)$/.test(t));
  if (!terms.length) return [];
  const flags = { before: 0, after: 0, limit: DOC_LINE_LIMIT, kinds: ['doc', 'config'], notPaths: [], fuzzy: true };
  try { return (await codeVerb(root, terms.join(' '), flags, refresh)).filter((r) => r.loc); } catch { return []; }
}

function renderHits(perFile, flags, extract) {
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
      if (extract) {
        for (const m of extract(lines[i])) rows.push({ loc: `${f.path}:${i + 1}`, text: clip(m) });
        continue;
      }
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

// Symbols of the listed files, extracted here: the answer when there is no index to ask.
function scanSymbols(files, text, flags, kinds) {
  const wanted = text && flags.fuzzy ? text.toLowerCase() : null;
  const out = [];
  for (const f of memFilter(files, flags, kinds)) {
    let body;
    try { body = readFileSync(f.abs, 'utf8'); } catch { continue; }
    for (const s of extractSymbols(f.lang, body, f.rel)) {
      if (text && (wanted ? !s.name.toLowerCase().includes(wanted) : s.name !== text)) continue;
      if (flags.types && !flags.types.includes(s.type)) continue;
      out.push({ path: f.rel, line: s.line, type: s.type, name: s.name, scope: s.scope });
    }
  }
  return out;
}

function indexedSymbols(handle, text, flags, kinds) {
  const { where, params } = sqlFilters(flags, kinds);
  if (text && flags.fuzzy) { where.push("s.name LIKE ? ESCAPE '\\'"); params.push(`%${text.replace(/[%_\\]/g, '\\$&')}%`); }
  else if (text) { where.push('s.name = ?'); params.push(text); }
  if (flags.types) { where.push(`s.type IN (${flags.types.map(() => '?').join(',')})`); params.push(...flags.types); }
  return handle.all(`SELECT f.path, s.line, s.type, s.name, s.scope FROM symbols s JOIN files f ON f.id = s.file_id WHERE ${where.join(' AND ')}`, params);
}

async function symVerb(root, text, flags, refresh) {
  const kinds = flags.kinds || DEFAULT_KINDS;
  const idx = await refresh(root, { tickets: kinds.includes('ticket') });
  const dropped = excluder(flags);
  const found = idx.handle ? indexedSymbols(idx.handle, text, flags, kinds) : scanSymbols(idx.files, text, flags, kinds);
  const rows = found.filter((r) => !dropped(r.path));
  idx.handle?.close();
  rows.sort((a, b) => (TYPE_RANK[a.type] ?? UNRANKED) - (TYPE_RANK[b.type] ?? UNRANKED) || a.path.localeCompare(b.path) || a.line - b.line);
  const cut = flags.limit ? rows.slice(0, flags.limit) : rows;
  const out = cut.map((r) => ({ loc: `${r.path}:${r.line}`, type: r.type, name: r.name, scope: r.scope }));
  if (flags.limit && rows.length > cut.length) out.push({ loc: '', type: '', name: `+${rows.length - cut.length} more — --limit 0 for all`, scope: '' });
  return out;
}

// `**/` also matches no directory at all (`**/hooks/*.mjs` finds `hooks/a.mjs`); a lone `*` still crosses `/`.
function globPathRegExp(glob) {
  const body = glob.split('**/').map((part) => [...part].map((c) => (c === '*' ? '.*' : c === '?' ? '.' : escapeRe(c))).join('')).join('(?:.*/)?');
  return new RegExp(`^${body}$`, 'i');
}

async function fileVerb(root, text, flags, refresh) {
  const idx = await refresh(root);
  idx.handle?.close();
  const isGlob = /[*?]/.test(text);
  const re = isGlob
    ? globPathRegExp(text)
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
  const rows = await answerRows(cmd, args, root, refresh);
  if (rows.some((r) => r.loc)) return rows;
  const missing = uncheckedFrameworks(root);
  if (!missing.length) return rows;
  const names = missing.map((m) => `${m.name} (${m.path})`).join(', ');
  return [...rows, { loc: '', text: `NOT searched: framework submodule ${names} is not checked out here, so "no results" proves nothing about it (git submodule update --init)` }];
}

async function answerRows(cmd, args, root, refresh) {
  const { text, flags } = parseCodeArgs(args);
  if (flags.unknown.length) return unknownFlagRows(cmd, args, flags.unknown, root);
  if (flags.project !== undefined) {
    root = projectRepo(flags.project);
    refresh = refreshIndex;
  }
  if (outsideIndex(flags, root)) {
    if (!existsSync(flags.path)) return [{ loc: '', text: `q --path ${flags.path}: outside the index and not found on disk` }];
    flags.dir = flags.path;
    flags.path = undefined;
  }
  if (flags.dir !== undefined) {
    const scanned = dirIndex(flags.dir);
    refresh = async () => scanned;
    root = flags.dir;
  }
  if (flags.path) flags.path = repoRelative(root, flags.path);
  if (cmd === 'code') return text ? codeVerb(root, text, flags, refresh) : [{ loc: '', text: 'usage: q code <text> [--regex] [-i] [-w] [--lang L] [--path P] [--not-path G] [-C n]' }];
  if (cmd === 'sym') return symVerb(root, text, flags, refresh);
  return text ? fileVerb(root, text, flags, refresh) : [{ loc: '', text: 'usage: q file <substring|glob>' }];
}
