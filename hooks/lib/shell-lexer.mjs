// shell-lexer.mjs — the one tokenizer the shell gates read command text with, so the segment splitter, the delete scan,
// the install scan, tree-delete and branch-guard agree on where every quote, escape, operator and substitution ends.
//
//   lex(text, { shell, blind, flat }) -> { tokens, ambiguity, marks }
//     shell  'bash' | 'powershell' | 'cmd' | '' (unknown: quotes pair plainly, no escape honoured, every doubt marked)
//     blind  quoting untrusted: quotes, backticks, brackets and angle brackets only separate words
//     flat   a substitution's opener and closer separate words; otherwise `$(...)`, `<(...)` and a bash backtick span
//            stay inside the word they sit in
//   tokens in text order, each with `start` and `end`: { kind: 'word', raw, value, literal, redirect } (value: quotes
//     dropped, escapes resolved as the shell does; literal: under bash a backslash before a letter, digit, `.`, `_` or
//     `-` stays, so `C:\dev\x` reads as written; redirect: the word a redirection names), { kind: 'op', op, depth }
//     (`;` `|` `||` `&&` `&`, a newline is `;`, at every depth), { kind: 'redirect' | 'heredoc', op } (an fd number is
//     part of it), { kind: 'open' | 'close', op } (`(` a group, `$(` `<(` `>(` and a backtick a substitution) and
//     { kind: 'comment' }. Comment text and heredoc bodies are inert (no quote or escape read; operators still split, so
//     their text is judged as code); a PowerShell here-string is one quoted span (shell-lexer-spans.mjs).
//   ambiguity  the first construct that leaves the reading unresolvable, { reason, at, span }; null when none (the
//              reasons of shell-lexer-rules.mjs AMBIGUOUS)
//   marks      [{ reason, at }] every construct not modelled exactly, in text order (also a substitution inside double
//              quotes, a comment or heredoc inside a group, an unknown shell's escape). A text cut fails closed on any.
//   words(text, opts) -> the word tokens of lex(text, opts)

import { belongsToRedirection } from './redirection-operator.mjs';
import { AMBIGUOUS, REASON, readsTypographicQuote, rulesFor, TYPOGRAPHIC_QUOTE } from './shell-lexer-rules.mjs';
import { backtickHoldsQuote, hasTerminator, heredocDelimiter, hereString as readHereString, opensHereString, substitutionHoldsQuote, terminates } from './shell-lexer-spans.mjs';

export { REASON, readsTypographicQuote, TYPOGRAPHIC_QUOTE };

const LEGACY_ESCAPE = /[\\`]["']/;
const UNKNOWN_ESCAPE = /[`^]|\\["'();|&]/;
const PLAIN_HASH_LEAD = /[\w${]/;
const COMMENT_LEAD = /[\s;&|()]/;
const CASE_WORD = 'case';
const CASE_LEAD = /[\s;&|(]/;
const COMMAND_BEFORE = /(?:^|[;&|()\n]|(?:^|\s)(?:then|do|else|elif|time|!|\{))\s*$/;
const SPACE = /\s/;
const QUOTE = /["']/;
const PATH_CHARACTER = /[A-Za-z0-9._-]/;
const REDIRECT = /^(?:&>>|&>|<<<|<<-|<<|>>|>\||>&|<&|<>|[<>])/;
const FD = /^\d+$/;
const BASH_DOUBLE_ESCAPES = '$`"\\\n';
const SPAN_RADIUS = 24;

const depthOf = (s) => s.stack.length + (s.backtick >= 0 ? 1 : 0);
const inSpan = (s) => s.spans && (s.backtick >= 0 || s.stack.some((open) => open.op !== '('));
const mark = (s, reason, at, extra) => s.marks.push({ reason, at, ...extra });
const emit = (s, kind, op, start, end) => s.tokens.push({ kind, op, start, end, depth: depthOf(s) });

// Appends text[from, to) to the current word: its raw characters inside a substitution, else `value` (and `literal`).
function add(s, from, to, value, literal = value) {
  if (!s.word) s.word = { start: from, value: '', literal: '' };
  const raw = inSpan(s) ? s.src.slice(from, to) : null;
  s.word.value += raw ?? value;
  s.word.literal += raw ?? literal;
}

function endWord(s, at) {
  if (!s.word) return;
  const { start, value, literal } = s.word;
  s.tokens.push({ kind: 'word', raw: s.src.slice(start, at), value, literal, start, end: at, redirect: s.target });
  s.word = null;
  s.target = false;
}

function closeQuote(s, i, doubled) {
  if (s.rules.doubled && s.src[i + 1] === doubled) { add(s, i, i + 2, doubled); s.quoteAt = i + 1; return i + 2; }
  s.quote = '';
  s.quoteTick = false;
  add(s, i, i + 1, '');
  return i + 1;
}

function quoted(s, i) {
  const { src, rules } = s;
  const ch = src[i];
  const next = src[i + 1];
  if (s.quote === "'") return ch === "'" ? closeQuote(s, i, "'") : (add(s, i, i + 1, ch), i + 1);
  if (s.quote === "$'") {
    if (ch === '\\' && i + 1 < src.length) { add(s, i, i + 2, next); return i + 2; }
    if (ch === "'") s.quote = '';
    add(s, i, i + 1, ch === "'" ? '' : ch);
    return i + 1;
  }
  if (rules.inDouble && ch === rules.escape && i + 1 < src.length) {
    const kept = rules.ansi && !BASH_DOUBLE_ESCAPES.includes(next) ? ch + next : next === '\n' ? '' : next;
    flagEscaped(s, i);
    add(s, i, i + 2, kept);
    return i + 2;
  }
  if (ch === '"') return closeQuote(s, i, '"');
  const substitution = ch === '$' && next === '(';
  if (substitution || (ch === '`' && rules.backtick)) mark(s, REASON.quotedSubstitution, i);
  if (substitution && rules.subs && substitutionHoldsQuote(src, i, rules.escape || '\\')) mark(s, REASON.quoteInSubstitution, i);
  if (ch === '`' && rules.backtick) {
    // Only the backtick that opens a span is checked: the one that closes it ends the span the opener's scan already covered.
    if (!s.quoteTick && backtickHoldsQuote(src, i)) mark(s, REASON.quoteInSubstitution, i);
    s.quoteTick = !s.quoteTick;
  }
  add(s, i, i + 1, ch);
  return i + 1;
}

// A PowerShell here-string is one quoted span to its closing line; a shell that may not read one marks it.
function hereString(s, i) {
  if (s.rules.markHereStrings) { mark(s, REASON.hereString, i); return -1; }
  const found = readHereString(s.src, i);
  if (!found) { mark(s, REASON.unclosed, i); return -1; }
  if (s.src[i + 1] === '"' && found.body.includes('$(')) mark(s, REASON.quotedSubstitution, i);
  add(s, i, found.end, found.body);
  return found.end;
}

// Comment text and heredoc bodies are inert: no quote, escape or substitution is read, operators still split.
function inert(s, i) {
  const { src, rules } = s;
  const ch = src[i];
  if (s.inert === 'block' && src.startsWith('#>', i)) { s.inert = ''; add(s, i, i + 2, '#>'); return i + 2; }
  if (ch === '\n' || (rules.ops.includes(ch) && !((ch === '|' || ch === '&') && belongsToRedirection(src, i)))) return operator(s, i);
  if (SPACE.test(ch) && !inSpan(s)) { endWord(s, i); return i + 1; }
  add(s, i, i + 1, ch);
  return i + 1;
}

// A newline ends a line comment, steps a heredoc body on to its terminator, and opens the bodies the line declared.
function newline(s, i) {
  const line = s.src.slice(s.lineStart, i);
  s.lineStart = i + 1;
  if (s.inert === 'line') s.inert = '';
  if (s.inert === 'body' && terminates(line, s.pending[0])) s.pending.shift();
  if (s.inert === 'body' && !s.pending.length) s.inert = '';
  if (s.inert || !s.pending.length) return;
  s.pending = s.pending.filter((heredoc) => hasTerminator(s.src, i + 1, heredoc));
  if (s.pending.length) s.inert = 'body';
}

// An escaped escape character still reads as one to a program's own argument parser (`` `\" `` under PowerShell).
const flagEscaped = (s, i) => {
  if (s.rules.flags?.includes(s.src[i + 1]) && QUOTE.test(s.src[i + 2] ?? '')) mark(s, REASON.escape, i + 1);
  if (s.src[i + 1] === s.rules.textQuote) mark(s, REASON.textQuote, i + 1);
};

function escaped(s, i) {
  const next = s.src[i + 1];
  flagEscaped(s, i);
  s.escapedTo = i + 2;
  if (next === '\n' && !s.word) return i + 2;
  const value = next === '\n' ? '' : next;
  add(s, i, i + 2, value, s.rules.ansi && PATH_CHARACTER.test(next) ? s.src[i] + next : value);
  return i + 2;
}

function openQuote(s, i) {
  const { src } = s;
  const dollar = src[i - 1] === '$';
  if (dollar) mark(s, REASON.dollar, i - 1);
  const ansi = s.rules.ansi && dollar && src[i] === "'" && s.escapedTo !== i;
  if (ansi && s.word && !inSpan(s)) { s.word.value = s.word.value.slice(0, -1); s.word.literal = s.word.literal.slice(0, -1); }
  s.quote = ansi ? "$'" : src[i];
  s.quoteAt = i;
  add(s, i, i + 1, '');
  return i + 1;
}

// Marks a case statement, and a comment or heredoc inside a group; a heredoc's delimiter (none inside `$((` or `((`)
// waits for its body, a hash that starts a word starts an inert comment (a PowerShell or unknown shell's `<#` one to `#>`).
function markUnbounded(s, i) {
  const { src, rules } = s;
  const after = src[i + CASE_WORD.length];
  if (src.startsWith(CASE_WORD, i) && (i === 0 || CASE_LEAD.test(src[i - 1])) && (after === undefined || SPACE.test(after))) {
    mark(s, REASON.caseStatement, i, { command: COMMAND_BEFORE.test(src.slice(0, i)) });
  }
  const hash = src[i] === '#' && (i === 0 || !PLAIN_HASH_LEAD.test(src[i - 1]));
  if ((hash || src.startsWith('<<', i)) && depthOf(s) > 0) mark(s, REASON.groupComment, i);
  const arithmetic = s.stack.some((opened) => opened.arithmetic);
  if (src.startsWith('<<', i) && !src.startsWith('<<<', i) && src[i - 1] !== '<' && !arithmetic) {
    const heredoc = heredocDelimiter(src, i);
    if (heredoc) s.pending.push(heredoc);
  }
  const prev = src[i - 1];
  const block = rules.blockComments && prev === '<';
  const wordStart = i === 0 || COMMENT_LEAD.test(prev) || (rules.backtick && prev === '`') || block;
  if (src[i] !== '#' || !wordStart) return;
  s.inert = block ? 'block' : 'line';
  const end = s.inert === 'block' ? src.indexOf('#>', i) : src.indexOf('\n', i);
  s.tokens.push({ kind: 'comment', start: i, end: end < 0 ? src.length : end });
}

function open(s, i, op) {
  const sub = op !== '(';
  if (sub && !s.spans) endWord(s, i);
  if (!sub && !inSpan(s)) endWord(s, i);
  emit(s, 'open', op, i, i + op.length);
  s.stack.push({ op, at: i, arithmetic: s.src[i + op.length] === '(' });
  if (inSpan(s)) add(s, i, i + op.length, op);
  return i + op.length;
}

function close(s, i) {
  const spanned = inSpan(s);
  s.stack.pop();
  if (spanned) add(s, i, i + 1, ')');
  else endWord(s, i);
  emit(s, 'close', ')', i, i + 1);
  return i + 1;
}

function backtick(s, i) {
  const opening = s.backtick < 0;
  const spanned = inSpan(s);
  if (!opening && spanned) add(s, i, i + 1, '`');
  s.backtick = opening ? i : -1;
  if (opening && s.spans) add(s, i, i + 1, '`');
  else if (!spanned || !s.spans) endWord(s, i);
  emit(s, opening ? 'open' : 'close', '`', i, i + 1);
  return i + 1;
}

function redirect(s, i) {
  const op = REDIRECT.exec(s.src.slice(i))[0];
  let start = i;
  if (s.word && op[0] !== '&' && FD.test(s.src.slice(s.word.start, i))) { start = s.word.start; s.word = null; } else endWord(s, i);
  s.tokens.push({ kind: op === '<<' || op === '<<-' ? 'heredoc' : 'redirect', op, start, end: i + op.length });
  s.target = true;
  return i + op.length;
}

function operator(s, i) {
  const { src } = s;
  const pair = src[i] + (src[i + 1] ?? '');
  const length = pair === '||' || pair === '&&' ? 2 : 1;
  if (inSpan(s)) add(s, i, i + length, pair.slice(0, length));
  else endWord(s, i);
  emit(s, 'op', length === 2 ? pair : src[i] === '\n' ? ';' : src[i], i, i + length);
  if (src[i] === '\n') newline(s, i);
  return i + length;
}

function step(s, i) {
  const { src, rules } = s;
  const ch = src[i];
  const next = src[i + 1] ?? '';
  if (s.inert) return inert(s, i);
  const closesBacktick = ch === '`' && rules.backtick && (s.quoteTick || s.backtick >= 0);
  if (rules.flags?.includes(ch) && s.quote !== "'" && s.quote !== "$'" && QUOTE.test(next) && !closesBacktick) mark(s, REASON.escape, i);
  if (s.quote) return quoted(s, i);
  if (rules.escape && ch === rules.escape && i + 1 < src.length) return escaped(s, i);
  if (rules.hereStrings && ch === '@' && opensHereString(src, i)) {
    const end = hereString(s, i);
    if (end >= 0) return end;
  }
  if (rules.quotes.includes(ch)) return openQuote(s, i);
  if (ch === rules.textQuote) mark(s, REASON.textQuote, i);
  if (!s.blind) markUnbounded(s, i);
  if (rules.subs && ch === '$' && next === '(') return open(s, i, '$(');
  if (rules.backtick && (ch === '<' || ch === '>') && next === '(') return open(s, i, `${ch}(`);
  if (ch === '(') return open(s, i, '(');
  if (ch === ')') return close(s, i);
  if (ch === '`' && rules.backtick) return backtick(s, i);
  if ((ch === '|' || ch === '&') && belongsToRedirection(src, i)) {
    if (!s.blind && ch === '&' && next === '>' && !inSpan(s)) return redirect(s, i);
    if (inSpan(s)) add(s, i, i + 1, ch); else endWord(s, i);
    return i + 1;
  }
  if (rules.ops.includes(ch)) return operator(s, i);
  if (inSpan(s)) { add(s, i, i + 1, ch); return i + 1; }
  if (SPACE.test(ch) || rules.separators?.includes(ch)) { endWord(s, i); return i + 1; }
  if (!s.blind && (ch === '<' || ch === '>')) return redirect(s, i);
  add(s, i, i + 1, ch);
  return i + 1;
}

function describe(src, reason, at) {
  const span = src.slice(Math.max(0, at - SPAN_RADIUS), at + SPAN_RADIUS).replace(/\r?\n/g, '\\n');
  return { reason, at, span };
}

function finish(s, shell) {
  const { src, rules } = s;
  endWord(s, src.length);
  if (s.quote) mark(s, REASON.unclosed, s.quoteAt);
  for (const opened of s.stack) if (opened.op !== '(') mark(s, REASON.unclosedSubstitution, opened.at);
  if (s.backtick >= 0) mark(s, REASON.unclosedSubstitution, s.backtick);
  if (rules.legacy) {
    const legacy = src.search(LEGACY_ESCAPE);
    if (legacy >= 0) mark(s, REASON.escape, legacy);
    const unknown = src.search(UNKNOWN_ESCAPE);
    if (unknown >= 0) mark(s, REASON.unknownEscape, unknown);
  }
  const typographic = !s.blind && readsTypographicQuote(shell) ? src.search(TYPOGRAPHIC_QUOTE) : -1;
  if (typographic >= 0) mark(s, REASON.typographic, typographic);
  s.marks.sort((a, b) => a.at - b.at);
  s.tokens.sort((a, b) => a.start - b.start);
  const counts = (m) => m.reason !== REASON.caseStatement || m.command;
  const first = AMBIGUOUS.map((reason) => s.marks.find((m) => m.reason === reason && counts(m))).find(Boolean);
  return { tokens: s.tokens, marks: s.marks, ambiguity: first ? describe(src, first.reason, first.at) : null };
}

export function lex(text, { shell = '', blind = false, flat = false } = {}) {
  const src = String(text);
  const rules = rulesFor(shell, blind);
  const s = { src, rules, blind, spans: !blind && !flat, tokens: [], marks: [], stack: [], backtick: -1, quote: '', quoteAt: -1, word: null, target: false, escapedTo: -1, inert: '', pending: [], lineStart: 0 };
  for (let i = 0; i < src.length;) i = step(s, i);
  return finish(s, shell);
}

export const words = (text, opts) => lex(text, opts).tokens.filter((t) => t.kind === 'word');
