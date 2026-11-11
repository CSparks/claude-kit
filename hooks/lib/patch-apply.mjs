// patch-apply.mjs — `git apply`, `git am` and `patch` write the files a diff names, and the diff text was authored
// outside Edit/Write, so none of pre-write's checks saw it (KIT-T1068). A write gate judges the files such a call
// names the way it judges a redirect.
//
//   patchApplyHits(text, { raw, shell, hit, readScript }) -> [hit]
//     text:   the segment text (its `< file` redirect names the patch)
//     raw:    the whole command, heredoc bodies included (the segment text has them cut)
//     hit(path), readScript(path): the caller's judge and its reader of temp files
//
// The targets come from the diff's own headers (`diff --git a/x b/x`, `--- a/x`, `+++ b/x`), read from the command
// itself and from every patch file it names (operand, `< file`, or, when the applier reads a pipe, any path in the
// command); a file that cannot be read names nothing and stays allowed. The applier is found past wrappers
// (`sudo`, `env A=1`, `command`, `timeout 5`...), never in the arguments of another command.
// A call that only checks or reports (`git apply --check|--stat|--numstat|--summary`, `patch --dry-run`) writes nothing.
// `git checkout <rev> -- <path>` restores content a commit or stash already holds, gated when it was written: not judged.
// A command another command runs is split into segments and judged by the same rules: the string a shell takes
// (`bash -c "..."`, `sh -lc`, `pwsh -Command`, `eval`, `su -c`), the clauses of `find -exec|-execdir|-ok|-okdir`, the remote
// command of `ssh`, the string of a `trap`, and every `$(...)`, backtick and `<(...)` substitution.
//
//   appliesPatch(text) -> boolean
//     the shell-write-scan fallback for a command whose quoting cannot be trusted: true when any piece, cut on every
//     operator, is led by an applier (or by a command whose operands run one); a flag cannot lift it, so `--check` also counts.

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { commandName, leadIndex } from './command-lead.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { runnerTexts } from './runner-texts.mjs';
import { blindSegments, segments, shellArgs, shellTokens } from './shell-segments.mjs';

const WORD = /"([^"]*)"|'([^']*)'|([^\s"'|;&<>()]+)/g;
const PATH_LIKE = /[\\/]|\.[A-Za-z0-9]{1,6}$/;
const PATH_WORD_LIMIT = 32;
const MAX_NESTING = 4;
const QUOTE_START = /^["']/;
const QUOTE_CHAR = /["']/;
const REDIRECT_TOKEN = /^\d*[<>]{1,2}&?(.*)$/;
const GROUP_START = /^[$({`]+/;
const GROUP_END = /[)}`]+$/;
const BLIND_SEPARATOR = /[\s"'`]+/;
const SUBSTITUTION_START = /[<>$]?\(|`/;

const DIFF_GIT = /diff --git ([^\s\\'"]+) ([^\s\\'"]+)/g;
const FILE_HEADER = /(?:\+\+\+|---) ([^\s\\'"]+)/g;
const STDIN_REDIRECT = /(?<!<)<(?![<(])\s*(?:"([^"]*)"|'([^']*)'|([^\s"'|;&<>)]+))/;
const DEV_NULL = '/dev/null';
const GIT_APPLY_STRIP = 1;
const PATCH_STRIP = 0;
const GIT_REPORT_ONLY = new Set(['--check', '--stat', '--numstat', '--summary', '--cached']);
const GIT_WRITES = new Set(['--apply', '--index']);
const AM_PASSIVE = new Set(['--show-current-patch', '--abort', '--quit', '--skip']);
const PATCH_REPORT_ONLY = new Set(['--dry-run', '--check', '-C']);
const PATCH_VALUE_SHORT = /^-[BdDFgioprVYz]$/;
const PATCH_VALUE_LONG = /^--(?:directory|input|output|reject-file|prefix|suffix|basename-prefix|version-control|fuzz|strip)$/;
const PATCH_STRIP_FLAG = /^(?:-p|--strip=)(\d+)$/;
const HEADER_TEXT_LIMIT = 1 << 22;

const REDIRECTION = /\d*[<>]{1,2}&?\s*(?:"[^"]*"|'[^']*'|[^\s|;&]+)/g;

const unquote = (s) => String(s).replace(/^["']|["']$/g, '');

/** The segment text without its redirections (`< f`, `<<'EOF'`, `> f`): what is left is the command's own arguments. */
export const withoutRedirects = (text) => String(text).replace(REDIRECTION, ' ');

function strippedPath(token, strip) {
  const parts = unquote(token).split('/');
  return token === DEV_NULL ? '' : parts.slice(Math.min(strip, parts.length - 1)).join('/');
}

/** The file paths the diff headers in `text` name, `strip` leading components removed. */
export function patchTargets(text, strip) {
  const body = String(text).slice(0, HEADER_TEXT_LIMIT);
  const tokens = [...body.matchAll(DIFF_GIT)].flatMap((m) => [m[1], m[2]]);
  tokens.push(...[...body.matchAll(FILE_HEADER)].map((m) => m[1]));
  return [...new Set(tokens.map((t) => strippedPath(t, strip)).filter(Boolean))];
}

/** The text of a patch file: a temp script through the caller's reader, any other regular file straight from disk ('' when unreadable). */
function fileText(path, readScript) {
  const name = unquote(path);
  const temp = readScript(name);
  if (temp) return temp;
  try {
    const abs = resolve(name);
    return statSync(abs).isFile() && statSync(abs).size <= HEADER_TEXT_LIMIT ? readFileSync(abs, 'utf8') : '';
  } catch { return ''; }
}

/** The path-like words of the whole command, quoted spans kept whole: the files a piped producer may read. */
function pathWords(raw) {
  const words = [...String(raw).matchAll(WORD)].map((m) => m[1] ?? m[2] ?? m[3]);
  return words.filter((w) => PATH_LIKE.test(w)).slice(0, PATH_WORD_LIMIT);
}

/** The command's text plus the text of every patch file it names; a stdin-reading applier also reads the files its pipeline names. */
function patchTexts(operands, { text, raw, readScript }, readsStdin) {
  const redirect = text.match(STDIN_REDIRECT);
  const source = redirect ? redirect[1] ?? redirect[2] ?? redirect[3] : '';
  const piped = readsStdin && !source ? pathWords(raw) : [];
  const files = operands.concat(source ? [source] : [], piped);
  return `${raw}\n${files.map((p) => fileText(p, readScript)).join('\n')}`;
}

function gitApplyTargets(sub, args, ctx) {
  const flags = args.filter((a) => a.startsWith('-'));
  if (sub === 'apply' && flags.some((f) => GIT_REPORT_ONLY.has(f)) && !flags.some((f) => GIT_WRITES.has(f))) return [];
  if (sub === 'am' && flags.some((f) => AM_PASSIVE.has(f))) return [];
  const strip = Number((flags.map((f) => /^-p(\d+)$/.exec(f)).find(Boolean) || [])[1] ?? GIT_APPLY_STRIP);
  const operands = args.filter((a) => !a.startsWith('-'));
  return patchTargets(patchTexts(operands, ctx, !operands.length), strip);
}

function patchCommandTargets(args, ctx) {
  const positionals = [];
  let strip = PATCH_STRIP;
  let input = '';
  let output = '';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (PATCH_REPORT_ONLY.has(a)) return [];
    const stripFlag = PATCH_STRIP_FLAG.exec(a);
    if (stripFlag) strip = Number(stripFlag[1]);
    else if (a === '-p' || a === '--strip') strip = Number(args[++i]);
    else if (a === '-i' || a === '--input') input = args[++i] || '';
    else if (a === '-o' || a === '--output') output = args[++i] || '';
    else if (PATCH_VALUE_SHORT.test(a) || PATCH_VALUE_LONG.test(a)) i++;
    else if (!a.startsWith('-')) positionals.push(a);
  }
  if (output) return [unquote(output)];
  if (positionals.length) return [unquote(positionals[0])];
  return patchTargets(patchTexts(input ? [input] : [], ctx, !input), strip);
}

const isApplier = (name, rest) => /^patch$/i.test(name) || (/^git$/i.test(name) && ['apply', 'am'].includes(gitCommand(rest).sub));

const leadsCommand = (name, rest) => isApplier(name, rest) || runnerTexts(name, rest, { blind: true }).length > 0;

const cleanWord = (word) => (QUOTE_START.test(word) ? word : word.replace(GROUP_START, '').replace(GROUP_END, ''));
const cleaned = (words) => words.map(cleanWord).filter(Boolean);

function applierHits(words, ctx) {
  const [applier, ...rest] = words;
  let dir = '';
  let targets = [];
  if (/^patch$/i.test(commandName(applier))) targets = patchCommandTargets(rest, ctx);
  else {
    const git = gitCommand(rest);
    dir = git.dir;
    targets = gitApplyTargets(git.sub, git.args, ctx);
  }
  return targets.map((p) => ctx.hit(dir ? `${dir}/${p}` : p)).filter(Boolean);
}

/** The segment's quote-aware tokens without its redirections (`< f`, `<<'EOF'`, `2>&1`): a quoted `<` stays in its token. */
function commandTokens(text) {
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
 * The hits of one segment's applier, found past wrappers and grouping words, and of every applier in a command the
 * segment runs from its operands or a substitution, judged by the same rules to MAX_NESTING levels.
 */
export function patchApplyHits(text, ctx, depth = 0) {
  const words = cleaned(shellArgs(withoutRedirects(text)));
  const at = leadIndex(words, isApplier);
  const own = at >= 0 ? applierHits(words.slice(at), { ...ctx, text }) : [];
  if (depth >= MAX_NESTING) return own;
  const runs = [
    ...(at >= 0 ? [] : runnerCommands(cleaned(commandTokens(text)), ctx.shell)),
    ...substitutions(text, ctx.shell).map((inner) => ({ text: inner, shell: ctx.shell })),
  ];
  return [...own, ...runs.flatMap((run) => [...segments(run.text, { shell: run.shell })].flatMap((seg) => patchApplyHits(seg.text, { ...ctx, shell: run.shell }, depth + 1)))];
}

const blindWords = (text) => cleaned(String(text).split(BLIND_SEPARATOR));

/**
 * True when some piece of `text`, cut on every operator whatever the quoting, runs `git apply` or `git am` anywhere in
 * it, or is led by `patch` or by a shell whose command string is. A caller whose quoting cannot be trusted blocks on it;
 * `echo patch` and `grep patch f` lead with a reader and name no applier.
 */
export function appliesPatch(text, depth = 0) {
  const pieces = blindSegments(text).flatMap((piece) => piece.text.split(SUBSTITUTION_START));
  return pieces.some((piece) => {
    const words = blindWords(piece);
    if (words.some((w, i) => /^git$/i.test(commandName(w)) && isApplier('git', words.slice(i + 1)))) return true;
    const at = leadIndex(words, leadsCommand);
    if (at < 0) return false;
    const name = commandName(words[at]);
    const rest = words.slice(at + 1);
    if (isApplier(name, rest)) return true;
    return depth < MAX_NESTING && runnerTexts(name, rest, { blind: true }).some((run) => appliesPatch(run.text, depth + 1));
  });
}
