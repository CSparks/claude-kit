// lead-command-walk.mjs — finds the commands a gate cares about wherever a shell would run them: led past wrappers and
// grouping words, and inside a command another command runs (patch-apply.mjs, git-discards.mjs).
//
//   leadCommandHits(text, ctx, { isLead, hitsOf }, depth) -> [hit]
//     text:    one segment's text
//     ctx:     the caller's context, passed to hitsOf with `text`, `lead` (the words before the command: wrappers, env
//              assignments) and, inside a nested command, that command's `shell`
//     isLead(name, restWords) -> boolean       the command the caller looks for
//     hitsOf(words, ctx) -> [hit]              the hits of the command found; `words` start at the command word
//   nestedSegments(text, shell) -> [{ text, after, shell }]   every segment of the command and of each command text it runs
//   withoutRedirects(text) -> string          the segment text without its redirections (`< f`, `<<'EOF'`, `> f`)
//   commandRuns(text, shell) -> [{ text, shell }]   the command texts one segment runs from its operands and substitutions
//   cleaned(words) -> string[]                 the words without grouping characters, empty ones dropped; a variable keeps its `$`
//   commandTokens(text) -> string[]            the quote-aware tokens (quotes kept) without redirections; a `>` inside a quoted string stays
//
// A command another command runs is split into segments and judged by the same rules: the string a shell takes
// (`bash -c "..."`, `sh -lc`, `pwsh -Command`, `eval`, `su -c`), the clauses of `find -exec|-execdir|-ok|-okdir`, the remote
// command of `ssh`, the string of a `trap`, and every `$(...)`, backtick and `<(...)` substitution, to MAX_NESTING levels.

import { commandName, leadIndex } from './command-lead.mjs';
import { runnerTexts } from './runner-texts.mjs';
import { segments, shellArgs, shellTokens } from './shell-segments.mjs';

export const MAX_NESTING = 4;
const QUOTE_START = /^["']/;
const QUOTE_CHAR = /["']/;
const REDIRECT_TOKEN = /^\d*[<>]{1,2}&?(.*)$/;
const GROUP_START = /^(?:\$\(|[({`])+/;
const GROUP_END = /[)}`]+$/;
const GROUP_END_KEEPING_BRACE = /[)`]+$/;
const PARAMETER_OPEN = '${';
const REDIRECTION_OR_QUOTED = /("[^"]*"|'[^']*')|\d*[<>]{1,2}&?\s*(?:"[^"]*"|'[^']*'|[^\s|;&]+)/g;

export const withoutRedirects = (text) => String(text).replace(REDIRECTION_OR_QUOTED, (_, quoted) => quoted ?? ' ');

// A variable (`$S`, `${S}`) keeps its `$`: only a grouping `$(`, `(`, `{` or backtick and the closers after a word are cut.
const groupEnd = (word) => word.replace(word.includes(PARAMETER_OPEN) ? GROUP_END_KEEPING_BRACE : GROUP_END, '');
const cleanWord = (word) => (QUOTE_START.test(word) ? word : groupEnd(word.replace(GROUP_START, '')));
export const cleaned = (words) => words.map(cleanWord).filter(Boolean);

/** The segment's quote-aware tokens without its redirections (`< f`, `<<'EOF'`, `2>&1`): a quoted `<` stays in its token. */
export function commandTokens(text) {
  const tokens = shellTokens(text);
  const kept = [];
  for (let i = 0; i < tokens.length; i++) {
    const redirect = REDIRECT_TOKEN.exec(tokens[i]);
    if (!redirect) kept.push(tokens[i]);
    else if (!redirect[1]) i++;
  }
  return kept;
}

/** The command strings a shell word list's lead command runs from its operands (runnerTexts), each with the shell it is written for. */
function runnerCommands(tokens, shellName) {
  const at = leadIndex(tokens, (name, rest) => runnerTexts(name, rest, { shell: shellName }).length > 0);
  return at < 0 ? [] : runnerTexts(commandName(tokens[at]), tokens.slice(at + 1), { shell: shellName });
}

/** The index of the `)` closing the parenthesis opened before `from`, quotes respected; the end of `text` when it never closes. */
function closingParen(text, from, escapes) {
  let depth = 1;
  let quote = '';
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (escapes && ch === '\\' && quote !== "'") i++;
    else if (quote) quote = ch === quote ? '' : quote;
    else if (QUOTE_CHAR.test(ch)) quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i;
  }
  return text.length;
}

/**
 * The command text inside every `$(...)`, `<(...)`, `>(...)` and backtick pair of `text` that a shell runs: none in a
 * single-quoted span or behind an escape. PowerShell has `$(...)` only. An unclosed one runs to the end; `$((1 + 2))` yields a harmless `(1 + 2)`.
 */
function substitutions(text, shellName) {
  const bash = shellName !== 'powershell';
  const found = [];
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if ((bash ? ch === '\\' : ch === '`') && quote !== "'") i++;
    else if (quote === "'") quote = ch === "'" ? '' : quote;
    else if (ch === quote) quote = '';
    else if (!quote && QUOTE_CHAR.test(ch)) quote = ch;
    else if ((ch === '$' && next === '(') || (bash && !quote && next === '(' && (ch === '<' || ch === '>'))) {
      const end = closingParen(text, i + 2, bash);
      found.push(text.slice(i + 2, end));
      i = end;
    } else if (bash && ch === '`') {
      const close = text.indexOf('`', i + 1);
      const end = close < 0 ? text.length : close;
      found.push(text.slice(i + 1, end));
      i = end;
    }
  }
  return found;
}

/**
 * Every segment of `text` and, to MAX_NESTING levels, of every command text a segment runs (a shell's `-c` string, `eval`,
 * `su -c`, `find -exec`, `ssh`, `trap`, a substitution): [{ text, after, shell }], the nested ones after their parent.
 */
export function nestedSegments(text, shell, depth = 0) {
  return [...segments(text, { shell })].flatMap((seg) => {
    const runs = depth >= MAX_NESTING ? [] : commandRuns(seg.text, shell);
    return [{ ...seg, shell }, ...runs.flatMap((run) => nestedSegments(run.text, run.shell, depth + 1))];
  });
}

/** The command texts one segment runs: its lead command's operand strings (runnerTexts) and every substitution, each with its shell. */
export const commandRuns = (text, shell) => [
  ...runnerCommands(cleaned(commandTokens(text)), shell),
  ...substitutions(text, shell).map((inner) => ({ text: inner, shell })),
];

/**
 * The hits of one segment's lead command, found past wrappers and grouping words, and of every such command in a
 * command the segment runs from its operands or a substitution, judged by the same rules to MAX_NESTING levels.
 */
export function leadCommandHits(text, ctx, lead, depth = 0) {
  const words = cleaned(shellArgs(withoutRedirects(text)));
  const at = leadIndex(words, lead.isLead);
  const own = at >= 0 ? lead.hitsOf(words.slice(at), { ...ctx, text, lead: words.slice(0, at) }) : [];
  if (depth >= MAX_NESTING) return own;
  const runs = [
    ...(at >= 0 ? [] : runnerCommands(cleaned(commandTokens(text)), ctx.shell)),
    ...substitutions(text, ctx.shell).map((inner) => ({ text: inner, shell: ctx.shell })),
  ];
  return [...own, ...runs.flatMap((run) => [...segments(run.text, { shell: run.shell })].flatMap((seg) => leadCommandHits(seg.text, { ...ctx, shell: run.shell }, lead, depth + 1)))];
}
