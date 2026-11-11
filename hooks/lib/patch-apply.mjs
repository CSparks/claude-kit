// patch-apply.mjs — `git apply`, `git am` and `patch` write the files a diff names, and the diff text was authored
// outside Edit/Write, so none of pre-write's checks saw it (KIT-T1068). A write gate judges the files such a call
// names the way it judges a redirect.
//
//   patchApplyHits(leader, args, { text, raw, hit, readScript }) -> [hit]
//     leader: the command word of the segment; args: the words after it (git: after `git`)
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

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gitCommand } from './git-subcommand.mjs';

const WORD = /"([^"]*)"|'([^']*)'|([^\s"'|;&<>()]+)/g;
const PATH_LIKE = /[\\/]|\.[A-Za-z0-9]{1,6}$/;
const PATH_WORD_LIMIT = 32;
const WRAPPER = /^(?:sudo|doas|env|command|exec|nohup|time|nice|ionice|timeout|stdbuf|xargs|builtin|setsid|unbuffer)$/i;
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NUMBER = /^\d+(?:\.\d+)?[smhd]?$/;

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

const commandName = (word) => String(word).replace(/.*[\\/]/, '').replace(/\.(?:exe|bat|cmd)$/i, '');
const isApplier = (name, rest) => /^patch$/i.test(name) || (/^git$/i.test(name) && ['apply', 'am'].includes(gitCommand(rest).sub));

/** The index of the applier in a command's words past any wrappers (`sudo -u root`, `env A=1`, `command`, `timeout 5`), -1 when none leads. */
function applierIndex(words) {
  let wrapped = false;
  let afterFlag = false;
  for (let i = 0; i < words.length; i++) {
    const name = commandName(words[i]);
    if (isApplier(name, words.slice(i + 1))) return i;
    const wrapper = WRAPPER.test(name);
    const flag = wrapped && words[i].startsWith('-');
    const value = wrapped && (afterFlag || NUMBER.test(words[i]));
    if (!wrapper && !ENV_ASSIGN.test(words[i]) && !flag && !value) return -1;
    wrapped ||= wrapper;
    afterFlag = flag;
  }
  return -1;
}

export function patchApplyHits(leader, args, ctx) {
  const words = [leader, ...args];
  const at = applierIndex(words);
  if (at < 0) return [];
  const [applier, ...rest] = words.slice(at);
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
