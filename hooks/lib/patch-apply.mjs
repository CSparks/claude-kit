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
// `git checkout <rev> -- <path>` and `git restore <path>` overwrite local changes: judged as discards (git-discards.mjs).
// A command another command runs is judged by the same rules (lead-command-walk.mjs).
//
//   appliesPatch(text) -> boolean
//     the shell-write-scan fallback for a command whose quoting cannot be trusted: true when any piece, cut on every
//     operator, is led by an applier (or by a command whose operands run one); a flag cannot lift it, so `--check` also counts.

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { commandName, leadIndex } from './command-lead.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { cleaned, leadCommandHits, MAX_NESTING } from './lead-command-walk.mjs';
import { runnerTexts } from './runner-texts.mjs';
import { blindSegments } from './shell-segments.mjs';

const WORD = /"([^"]*)"|'([^']*)'|([^\s"'|;&<>()]+)/g;
const PATH_LIKE = /[\\/]|\.[A-Za-z0-9]{1,6}$/;
const PATH_WORD_LIMIT = 32;
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

const unquote = (s) => String(s).replace(/^["']|["']$/g, '');

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

/** The hits of every applier in the segment `text`, found past wrappers and in commands the segment runs (lead-command-walk.mjs). */
export const patchApplyHits = (text, ctx) => leadCommandHits(text, ctx, { isLead: isApplier, hitsOf: applierHits });

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
