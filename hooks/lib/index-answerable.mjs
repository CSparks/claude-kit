// Which grep/rg invocations the code index answers EXACTLY (KIT-T101), and the `q code`
// command that answers them. The query gate redirects only these; anything else (an option the
// index does not model, a regex dialect JS cannot run, an unscoped language) stays allowed.
//
//   indexEquivalent(command, { qPath, root, cwd }) -> { q, shape } | null
//
// shape: literal | fixed | regex. Supported flags: -r -R -n -H -s -i -w -F -E -l -c -A/-B/-C N,
// --include=*.ext / -g '*.ext' / -t TYPE (the language scope), --no-heading, --color=…
// The index covers code, docs and config by extension, so a redirect needs an explicit language
// scope (include glob or type) — otherwise grep would also read unindexed file kinds.

import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { classify } from '../../scripts/code-index-extract.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { unquoteSpans } from './shell-segments.mjs';

const GREP_TOOLS = new Set(['grep', 'egrep', 'fgrep', 'rg']);
const RG_TYPE = { rust: 'rust', py: 'py', python: 'py', md: 'md', markdown: 'md', toml: 'toml', json: 'json', yaml: 'yaml', sh: 'sh', css: 'css', html: 'html', go: 'go', java: 'java', c: 'c', cpp: 'cpp' };
const IGNORED_FLAGS = new Set(['-r', '-R', '-n', '-H', '-s', '--recursive', '--line-number', '--no-heading', '--with-filename', '--no-messages', '-I', '--no-ignore-messages']);
const REGEX_META = /[.[\]\\^$*+?(){}|]/;
const GLOB_EXT = /^(?:(.*)[\\/])?\*\.([A-Za-z0-9]+)$/;
// Constructs the JS RegExp engine reads differently from grep/rg.
const FOREIGN_REGEX = /\(\?(?!:)|\[\[:|\\[pPhRAzZKGXQE]|\(\?P</;
// realpath of the nearest existing ancestor plus the remainder, so a path that does not exist yet
// still compares equal to the repo root (8.3 names, junctions, drive-letter case).
function canon(p) {
  const rest = [];
  let cur = resolve(p);
  while (!existsSync(cur) && dirname(cur) !== cur) { rest.unshift(basename(cur)); cur = dirname(cur); }
  try { cur = realpathSync.native(cur); } catch { /* keep */ }
  return join(cur, ...rest);
}
export const quote = (s) => (/^[\w./:=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

const WORD = /(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^\s"'])+/g;
const tokens = (c) => (c.trim().match(WORD) || []).map(unquoteSpans);

/**
 * The `q code` equivalent of a recursive grep/rg `command`, or null when not answerable exactly.
 * `file: true` judges a search of ONE named file instead: no language scope is needed and the file is `--dir`
 * (q scans any file on demand: gitignored, unindexed, outside the repo).
 */
export function indexEquivalent(command, { qPath, root, cwd = process.cwd(), file = false }) {
  const toks = tokens(command);
  let tool = (toks.shift() || '').replace(/.*[\\/]/, '').toLowerCase();
  if (tool === 'git') {
    const git = gitCommand(toks);
    if (git.sub === 'grep') { toks.splice(0, toks.length, ...git.args); tool = 'grep'; }
  }
  if (!GREP_TOOLS.has(tool)) return null;
  const f = { fixed: tool === 'fgrep', ext: tool === 'egrep' || tool === 'rg', ignore: false, word: false, files: false, count: false, ctx: [], lang: '' };
  const pos = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t.startsWith('-') || t === '-') { pos.push(t); continue; }
    if (IGNORED_FLAGS.has(t) || /^--color(=.*)?$/.test(t)) continue;
    if (t === '-i') f.ignore = true;
    else if (t === '-w') f.word = true;
    else if (t === '-F') f.fixed = true;
    else if (t === '-E') f.ext = true;
    else if (t === '-l') f.files = true;
    else if (t === '-c') f.count = true;
    else if (/^-[ABC]$/.test(t) && /^\d+$/.test(toks[i + 1] || '')) { f.ctx.push(t, toks[++i]); }
    else if (/^-[ABC]\d+$/.test(t)) f.ctx.push(t.slice(0, 2), t.slice(2));
    else if (/^--include=/.test(t)) f.lang = classify(`x${t.slice(t.lastIndexOf('.'))}`)?.lang || '!';
    else if ((t === '-g' || t === '--glob') && toks[i + 1]) { const g = toks[++i]; f.lang = classify(`x${g.slice(g.lastIndexOf('.'))}`)?.lang || '!'; }
    else if ((t === '-t' || t === '--type') && toks[i + 1]) f.lang = RG_TYPE[toks[++i].toLowerCase()] || '!';
    else if (/^-[rRnHsi]{2,}$/.test(t)) { if (t.includes('i')) f.ignore = true; }
    else return null; // an option the index does not model
  }
  // A lone `<dir>/*.<ext>` operand is the language scope of its extension within that directory (the index also walks below it).
  const globLang = !file && !f.lang && pos.length === 2 ? classify(`x.${GLOB_EXT.exec(pos[1])?.[2]}`)?.lang : '';
  if (globLang) f.lang = globLang;
  if (pos.length < 1 || (!file && (!f.lang || f.lang === '!'))) return null;
  const pattern = pos[0];
  if (!pattern || pattern.includes('\n')) return null;
  if (file && pos.length !== 2) return null;
  const rel = [];
  for (const p of file ? [] : pos.slice(1)) {
    const glob = GLOB_EXT.exec(p);
    const place = glob ? glob[1] ?? '.' : p;
    const abs = canon(isAbsolute(place) ? place : resolve(cwd, place));
    const r = relative(canon(root), abs).replace(/\\/g, '/');
    if (r.startsWith('..') || isAbsolute(r) || /[*?[]/.test(r)) return null;
    rel.push(r === '' ? '' : r);
  }
  if (rel.length > 1) return null;
  const literal = !REGEX_META.test(pattern);
  let shape;
  if (f.fixed || literal) shape = f.fixed && !literal ? 'fixed' : 'literal';
  else if (f.word) return null; // -w on a regex: boundary semantics differ between engines
  else if (f.ext && !FOREIGN_REGEX.test(pattern)) {
    try { new RegExp(pattern); shape = 'regex'; } catch { return null; }
  } else return null; // BRE metacharacters or a foreign regex dialect
  const args = ['code', quote(pattern)];
  if (shape === 'regex') args.push('--regex');
  if (f.ignore) args.push('-i');
  if (f.word) args.push('-w');
  if (file) args.push('--dir', quote(cwd === process.cwd() ? pos[1] : resolve(cwd, pos[1]).replace(/\\/g, '/')));
  else {
    args.push('--lang', f.lang);
    if (rel[0]) args.push('--path', rel[0]);
  }
  args.push(...f.ctx);
  if (f.files) args.push('-l');
  if (f.count) args.push('-c');
  return { q: `node "${qPath}" ${args.join(' ')}`, shape, pattern };
}
