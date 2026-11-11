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
// itself and from a patch file under the temp dir; a patch file elsewhere is another author's work and stays allowed.
// A call that only checks or reports (`git apply --check|--stat|--numstat|--summary`, `patch --dry-run`) writes nothing.
// `git checkout <rev> -- <path>` restores content a commit or stash already holds, gated when it was written: not judged.

import { gitCommand } from './git-subcommand.mjs';

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

const readable = (paths, readScript) => paths.map((p) => readScript(unquote(p))).join('\n');

function patchTexts(operands, text, raw, readScript) {
  const redirect = text.match(STDIN_REDIRECT);
  const source = redirect ? redirect[1] ?? redirect[2] ?? redirect[3] : '';
  return `${raw}\n${readable(operands.concat(source ? [source] : []), readScript)}`;
}

function gitApplyTargets(sub, args, { text, raw, readScript }) {
  const flags = args.filter((a) => a.startsWith('-'));
  if (sub === 'apply' && flags.some((f) => GIT_REPORT_ONLY.has(f)) && !flags.some((f) => GIT_WRITES.has(f))) return [];
  if (sub === 'am' && flags.some((f) => AM_PASSIVE.has(f))) return [];
  const strip = Number((flags.map((f) => /^-p(\d+)$/.exec(f)).find(Boolean) || [])[1] ?? GIT_APPLY_STRIP);
  return patchTargets(patchTexts(args.filter((a) => !a.startsWith('-')), text, raw, readScript), strip);
}

function patchCommandTargets(args, { text, raw, readScript }) {
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
  return patchTargets(patchTexts(input ? [input] : [], text, raw, readScript), strip);
}

export function patchApplyHits(leader, args, ctx) {
  let targets = [];
  let dir = '';
  if (/^patch$/i.test(leader)) targets = patchCommandTargets(args, ctx);
  else if (/^git$/i.test(leader)) {
    const git = gitCommand(args);
    if (git.sub !== 'apply' && git.sub !== 'am') return [];
    dir = git.dir;
    targets = gitApplyTargets(git.sub, git.args, ctx);
  }
  return targets.map((p) => ctx.hit(dir ? `${dir}/${p}` : p)).filter(Boolean);
}
