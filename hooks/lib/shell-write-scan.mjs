// Finds the hand write in a shell command (redirect, mv/rm/cp, sed -i, a PowerShell cmdlet, `node -e`,
// a heredoc, a scratch script, `git apply` / `git am` / `patch` of a diff: patch-apply.mjs) aimed at a path some gate
// protects. Callers supply the policy:
//
//   scanAllShellWrites(command, { hit, codeHit, readScript, judgeMoveSources, exemptByDestination, removals, shell }) -> every hit
//     shell ('bash' | 'powershell'): the escape rules segments() applies; omitted, any escape before a quote is ambiguous
//   scanShellWrites(command, options) -> the first hit, or null
//     hit(path)     judge one operand path of a writing command or redirect
//     codeHit(code) judge inline code, a heredoc body or a scratch script that writes files
//     readScript(p) the text of a script the command runs ('' when unreadable)
//     hit results of rm, del, erase, unlink and Remove-Item (every operand) carry `deletes: true`: a caller may exempt a file it owns
//     every hit of a segment carries `segment`, its index in the command's segments (a relative path is relative to the
//       directory after the `cd` segments before that index: shell-cwd.mjs)
//     judgeMoveSources  judge every operand of a mv (a gate that protects its files from removal)
//     exemptByDestination  a cp/mv whose shape is proven by shell-copy-target.mjs returns its source hits tagged
//       `outsideTo: <destination>`; the CALLER exempts exactly those when the destination lands outside every
//       adopted repo. Any other copy or move judges every operand as a write.
//     removals  { unresolved(operand) -> hit, sweep({ verb, path, what }) -> hit }: a gate that judges what a call removes.
//       A delete's operands are read after the command's own literal variables expand; an operand whose last path component
//       a variable or substitution still supplies goes to `unresolved`. A git call that deletes or hides files
//       (git-discards.mjs) yields its named files through `hit` and, when it may take unnamed ones, a `sweep`.
//
// A write tool counts WHEREVER its name appears as a word (`sudo -u root sed -i`, `ssh -i k host tee x`): no wrapper
// is parsed, so a deny gate cannot be steered by how a wrapper takes its options. The one text blanked is the quoted
// remote command of an ssh call, which runs on another machine (ssh-remote-mask.mjs, KIT-T1471). A segment led by
// a reader or a kit verb is no write tool, but its redirects are judged: a kit or git segment counts only a `>`
// outside quotes (KIT-T951). A node call is judged on every module it loads, except repo and package modules.
// An applier is the command a segment leads with, past wrappers and grouping words, also in a command another runs
// (`bash -c "..."`, `find -exec`, `ssh host`, a `trap` string, a `$(...)` substitution: patch-apply.mjs); a copy
// destination holding a variable the command assigns once and literally is judged by the value (shell-variables.mjs).
// An `install` that a known non-copying command owns (`npm install x@1`, `ninja -C build install`: install-owner.mjs) is that
// tool's work; an `install` leading a command, or following an unknown command, is the coreutils copy.
// A segment led by a `touch` with only mtime options tags its hits `mtimeOnly` for the caller (touch-target.mjs).

import { readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { isNodeInlineFlag, nodeLoadedModules } from './node-args.mjs';
import { KIT_TOOL, kitLed } from './kit-led.mjs';
import { moveLinesCall } from './move-lines-call.mjs';
import { discardHits, discardsBlind } from './git-discards.mjs';
import { copyTargets } from './shell-copy-target.mjs';
import { commandCwd } from './shell-cwd.mjs';
import { touchTargets } from './touch-target.mjs';
import { touchPlaceKnown } from './touch-place.mjs';
import { appliesPatch, patchApplyHits } from './patch-apply.mjs';
import { blindSegments, dequoted, segments } from './shell-segments.mjs';
import { fromCommandWord } from './command-lead.mjs';
import { launcherProblem } from './builds-run-args.mjs';
import { assignedValues, expandVariables } from './shell-variables.mjs';
import { copyVariable } from './copy-variable.mjs';
import { leaderValues, resolveLeader } from './variable-leader.mjs';
import { gitInnerHits } from './git-inner-hits.mjs';
import { cleaned, commandTokens } from './lead-command-walk.mjs';
import { runnerTexts } from './runner-texts.mjs';
import { blankArgumentInstall, leadsNoInstall } from './package-install.mjs';
import { maskSshRemote } from './ssh-remote-mask.mjs';
import { deleteHits } from './delete-hits.mjs';
import { words } from './shell-lexer.mjs';

// Every run of characters outside whitespace, quotes, backticks, operators, brackets and angle brackets, with its start.
const wordsIn = (text) => words(text, { blind: true }).map((word) => ({ w: word.raw, at: word.start }));

const BUILDS_LEAD = /^builds(?:\.cmd)?$/i;
const RUN_FLAG = '--run';

export { KIT_TOOL, kitLed };
const READER = /^(?:grep|egrep|fgrep|rg|ag|ack|cat|less|more|head|tail|wc|ls|stat|file|diff|cmp)$/i;
const WRITING_CMD = /^(?:rm|rd|del|erase|ren|rename|rmdir|unlink|tee|touch|truncate|remove-item|rename-item|new-item|set-content|add-content|out-file|clear-content)$/i;
const TOUCH_CMD = /^touch$/i;
// echo and printf only print their arguments: a write-tool word among them is text, unless the text runs (a substitution
// outside single quotes) or the command feeds its output to a shell or an eval.
const PRINTER = /^(?:echo|printf)$/i;
const SINGLE_QUOTED = /'[^']*'/g;
const RUNS_ARGUMENT_TEXT = /\$\(|`|[<>]\(/;
const FEEDS_A_SHELL = /\|\s*(?:sudo\s+)?(?:(?:ba|z|da|k)?sh|pwsh|powershell)\b|\b(?:eval|source)\s|\b(?:iex|invoke-expression)\b/i;
const printsOnly = (leader, text, raw) => PRINTER.test(leader) && !RUNS_ARGUMENT_TEXT.test(text.replace(SINGLE_QUOTED, '')) && !FEEDS_A_SHELL.test(String(raw || text));
const DELETE_CMD =/^(?:rm|del|erase|unlink|remove-item)$/i;
const MOVE_CMD = /^(?:mv|move-item)$/i;
const COPY_CMD = /^(?:cp|copy|copy-item|install|mv|move-item)$/i;
const IN_PLACE_TOOL = /^(?:sed|perl)$/i;
const IN_PLACE_FLAG = /^(?:-[A-Za-z]*i[A-Za-z]*|--in-place(?:=.*)?)$/;
const INTERPRETER = /^(?:node|python3?|py|powershell|pwsh)$/i;
const INLINE_FLAG = /^(?:-e|--eval|-p|--print|-c|-command)$/i;
const SCRIPT_FILE = /\.(?:m?js|cjs|py|ps1)$/i;
const DATA_URL = /^data:/i;
const REDIRECT = /(?<![-=])>>?\s*(["']?)([^\s"'|;&<>)`]+)/g;
const HEREDOC_CODE = /\b(?:node|python3?)(?:\.exe)?\s+-?\s*<<-?/i;
const PIPED_CODE = /\|\s*(?:node|python3?|py)(?:\.exe)?(?:\s+-)?\s*(?:$|[|;&\n])/i;

export const WRITE_NAMES = 'writeFile(?:Sync)?|writeSync|writev(?:Sync)?|appendFile(?:Sync)?|openSync|renameSync|rmSync|rmdirSync|unlinkSync|copyFileSync|cpSync|truncateSync|ftruncateSync|symlinkSync|linkSync|createWriteStream|outputFile|WriteAllText|WriteAllLines|WriteAllBytes';
// Methods only (`fs.rm(`, `p.unlink()`): a bare word before `(` is as often prose, as in "t unlink (or replace)".
export const WRITE_CALLS = 'rename|rm|rmdir|unlink|copyFile|cp|truncate|symlink|link|write_text|write_bytes|touch';
const PYTHON_MODULE_WRITE = String.raw`\b(?:os\.(?:remove|unlink|replace|rename|open|rmdir|removedirs|truncate)|shutil\.\w+)\b`;
const OPEN_FOR_WRITE = String.raw`\bopen\s*\([^)]*['"][rbtU]*[wax+][bt+]*['"]`;

/**
 * True when `code` calls a filesystem write API of node, python or .NET. A pre-scan that only ever adds
 * blocks: where the call writes is the effect detector's question (KIT-D117).
 */
export const FS_WRITE = new RegExp(String.raw`\b(?:${WRITE_NAMES})\b|\.(?:${WRITE_CALLS})\s*\(|${PYTHON_MODULE_WRITE}|\bfs\s*\[|\.promises\b|${OPEN_FOR_WRITE}`);

const nameOf = (word) => word.replace(/.*[\\/]/, '').replace(/\.exe$/i, '');
const BASH_ESCAPE = /\\(.)/gs;
const listed = (found) => [].concat(found || []);

/**
 * The target of every `>` or `>>` in `text`; with `outsideQuotes` a `>` inside a quoted span is skipped. With
 * `bashEscapes` (the caller knows the shell is bash) a backslash outside single quotes escapes the next character.
 */
export function redirectTargets(text, outsideQuotes, bashEscapes = false) {
  const quoted = new Array(text.length).fill(false);
  let open = '';
  for (let i = 0; i < text.length && outsideQuotes; i++) {
    quoted[i] = open !== '' || text[i] === '"' || text[i] === "'";
    if (bashEscapes && text[i] === '\\' && open !== "'") { quoted[i + 1] = true; i++; continue; }
    if (open) { if (text[i] === open) open = ''; } else if (text[i] === '"' || text[i] === "'") open = text[i];
  }
  return [...text.matchAll(REDIRECT)].filter((m) => !quoted[m.index]).map((m) => m[2]);
}

function judgeNodeModules(rest, text, { codeHit, readScript }) {
  const operands = rest.map((r) => r.w);
  const loaded = nodeLoadedModules(operands);
  const script = operands.find((a) => SCRIPT_FILE.test(a) && !a.startsWith('-') && !loaded.includes(a));
  for (const module of script ? [...loaded, script] : loaded) {
    const code = DATA_URL.test(module) ? text.slice(Math.max(0, text.indexOf(module))) : readScript(module);
    const found = code && codeHit(code);
    if (found) return found;
  }
  return null;
}

// The destination of a copy or move is judged as a write. A proven shape also yields its source hits tagged with the
// path each source lands at, for a caller that can show that path leaves the repo; anything else judges every operand.
function judgeCopy(tool, argText, ctx) {
  const expanded = expandVariables(argText, ctx.vars, ctx.shell);
  const { proven, writes } = copyTargets(tool, expanded);
  const { hit } = ctx;
  if (!proven) {
    const open = copyVariable(tool.toLowerCase(), expanded, ctx.parts, ctx.at, ctx.vars, ctx.shell);
    return writes.map(hit).filter(Boolean).map((h) => (open ? { ...h, copyVariable: open } : h));
  }
  const tagged = ctx.exemptByDestination
    ? proven.sources.flatMap((source, i) => { const h = hit(source); return h ? [{ ...h, outsideTo: proven.landings[i] }] : []; })
    : [];
  return [proven.destination, ...proven.under].map(hit).concat(tagged).filter(Boolean);
}

function judgeTool(tool, rest, text, ctx, argText) {
  const { hit, codeHit, readScript } = ctx;
  const operands = rest.map((r) => r.w);
  if (DELETE_CMD.test(tool)) return deleteHits(ctx, argText);
  if (WRITING_CMD.test(tool)) return operands.map(hit).find(Boolean) || null;
  if (MOVE_CMD.test(tool) && ctx.judgeMoveSources) return operands.map(hit).find(Boolean) || null;
  if (COPY_CMD.test(tool)) return judgeCopy(tool, argText, ctx);
  if (IN_PLACE_TOOL.test(tool)) return operands.some((a) => IN_PLACE_FLAG.test(a)) ? operands.map(hit).find(Boolean) || null : null;
  if (!INTERPRETER.test(tool)) return null;
  const isNode = /^node$/i.test(tool);
  const inline = rest.find((r) => INLINE_FLAG.test(r.w) || (isNode && isNodeInlineFlag(r.w)));
  if (inline) return codeHit(text.slice(inline.at + inline.w.length));
  if (isNode) return judgeNodeModules(rest, text, ctx);
  const script = operands.find((a) => SCRIPT_FILE.test(a));
  return script ? codeHit(readScript(script)) : null;
}

// A segment led by `touch` whose arguments are provably mtime-only: its file hits carry `mtimeOnly: { noCreate }`
// for a caller that can show the file exists. Null for any other touch, which is judged as a write tool.
function judgeTouch(argText, ctx) {
  if (!ctx.touchPlaceKnown) return null;
  const proven =touchTargets(expandVariables(argText, ctx.vars, ctx.shell), ctx.shell === 'powershell');
  if (!proven) return null;
  return proven.files.map(ctx.hit).filter(Boolean).map((h) => ({ ...h, mtimeOnly: { noCreate: proven.noCreate } }));
}

function judgeSegment(segmentText, ctx) {
  const whole = resolveLeader(segmentText, ctx.leaders);
  const text = maskSshRemote(whole);
  const words = wordsIn(text);
  if (!words.length) return [];
  const leader = nameOf(words[0].w);
  // `builds --run "<command>"`: its quoted command is scanned as a command of its own below, so a `>` inside the quotes is no
  // redirect of the launcher (KIT-T1284).
  const buildsRun = BUILDS_LEAD.test(leader) ? runnerTexts(leader, cleaned(commandTokens(text)).slice(1), { shell: ctx.shell }) : [];
  const quotedArgsInert = kitLed(text, ctx.cwd) || /^git$/i.test(leader) || buildsRun.length > 0;

  const hits = redirectTargets(text, quotedArgsInert, ctx.shell === 'bash').map(ctx.hit).filter(Boolean);
  hits.push(...patchApplyHits(whole, ctx));
  if (ctx.removals) hits.push(...discardHits(text, ctx), ...gitInnerHits(expandVariables(text, ctx.vars, ctx.shell), ctx, judgeSegment));
  const move = moveLinesCall(text, ctx.cwd);
  if (move && move.problem) hits.push(...move.paths.map(ctx.hit).filter(Boolean).map((h) => ({ ...h, moveLinesProblem: move.problem })));
  // `builds --run "<command>"`: the quoted command is judged as itself, as a direct call of it would be, a `cd` inside it
  // moving the directory its later hits resolve against (KIT-T1284). The launcher's working-directory option in any form
  // is refused, and the quoted command is scanned whatever the launcher's flags say.
  if (BUILDS_LEAD.test(leader)) {
    const tokens = commandTokens(text);
    const launches = tokens.some((token) => dequoted(token).replace(/["']/g, '') === RUN_FLAG);
    const problem = launches ? launcherProblem(tokens, ctx.cwd) : '';
    const own = problem ? [{ path: RUN_FLAG, launcherProblem: problem }] : [];
    if (buildsRun.length || problem) {
      const nested = buildsRun.flatMap((run) => scanAllShellWrites(run.text, { ...ctx, shell: run.shell })
        .map((found) => ({ ...found, from: found.from || commandCwd(run.text, ctx.cwd, { upto: found.segment, shell: run.shell }) })));
      return [...hits, ...own, ...nested];
    }
  }
  if (quotedArgsInert || READER.test(leader) || printsOnly(leader, text, ctx.raw)) return hits;
  const touched = TOUCH_CMD.test(leader) ? judgeTouch(text.slice(words[0].at + words[0].w.length), ctx) : null;
  if (touched) return [...hits, ...touched];
  const installIsArgument = leadsNoInstall(text, ctx.shell);
  for (let i = 0; i < words.length; i++) {
    const read = unescaped(words[i].w, ctx.shell);
    if (installIsArgument && /^install$/i.test(read)) continue;
    for (const name of new Set([nameOf(words[i].w), nameOf(read)])) {
      const found = listed(judgeTool(name, words.slice(i + 1), text, ctx, text.slice(words[i].at + words[i].w.length)));
      hits.push(...found.map((h) => ({ ...h, token: words[i].w })));
    }
  }
  return hits;
}

// A word as bash reads it: a backslash outside quotes escapes the next character (`r\m` runs rm).
const unescaped = (word, shell) => (shell === 'bash' ? word.replace(BASH_ESCAPE, '$1') : word);

/** The text of a script under the temp dir ('' elsewhere or when unreadable): scratch scripts are judged, repo scripts are not. */
export function readTempScript(path) {
  try {
    const abs = realpathSync.native(resolve(path));
    const rel = relative(realpathSync.native(resolve(tmpdir())), abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return '';
    return readFileSync(abs, 'utf8');
  } catch { return ''; }
}

const wordsOf = (...patterns) => patterns.map((p) => p.source.slice('^(?:'.length, -')$'.length)).join('|');
const WRITE_TOKEN = new RegExp(`\\b(?:${wordsOf(WRITING_CMD, COPY_CMD, IN_PLACE_TOOL)})\\b|>`, 'i');
// Redirections that write no file: fd duplication (`2>&1`, `>&2`) and output sent to the null device.
const HARMLESS_REDIRECT = /\d*>&(?:\d+|-)|\d*&?>>?\s*\/dev\/null\b/g;

// With ambiguous quoting no segment can be trusted: a write-tool word, a `>` or a filesystem write call
// anywhere in the command is a hit, and `ambiguous({ reason, at, span, trigger })` builds the gate's result for it. Pieces cut on every
// operator, quoting ignored, that a kit verb leads are read-only searches: a write token in a `q` pattern is
// not a write, but a redirect in one is still judged by its target, and a write behind an operator is its own
// piece and still tested.
// Returns the write word that made it a hit ('' for none), so a block can name it.
const ambiguousWrite = (text, hit, cwd, removals) => {
  const pieces = blindSegments(text);
  const kitPieces = pieces.filter((s) => kitLed(s.text, cwd));
  const kitRedirect = kitPieces.flatMap((s) => redirectTargets(s.text, false)).find((target) => hit(target));
  if (kitRedirect) return `> ${kitRedirect}`;
  const rest = pieces
    .filter((s) => !kitPieces.includes(s))
    .map((s) => blankArgumentInstall(s.text))
    .join(' ; ')
    .replace(HARMLESS_REDIRECT, ' ');
  return WRITE_TOKEN.exec(rest)?.[0] || (appliesPatch(rest) ? 'a patch apply' : '') || (removals && discardsBlind(rest) ? 'a git discard' : '') || FS_WRITE.exec(rest)?.[0] || '';
};

export function scanAllShellWrites(command, { hit, codeHit, readScript = readTempScript, ambiguous, judgeMoveSources = false, exemptByDestination = false, removals = null, shell = '' }) {
  const parts = segments(String(command || ''), { shell });
  const text = parts.text;
  if (parts.ambiguous && ambiguous) {
    const trigger = ambiguousWrite(text, hit, commandCwd(String(command || ''), process.cwd(), { shell }), removals);
    return trigger ? [ambiguous({ ...parts.ambiguity, trigger })] : [];
  }
  if (HEREDOC_CODE.test(text) || PIPED_CODE.test(text)) return listed(codeHit(text));
  const ctx = { hit, codeHit, readScript, judgeMoveSources, exemptByDestination, removals, shell, parts, raw: String(command || '') };
  const variables = assignedValues(parts, shell);
  const leaders = leaderValues(parts, shell);
  const all = [...parts];
  return all.flatMap((seg, i) => judgeSegment(seg.text, { ...ctx, at: i, vars: variables.get(seg), leaders: leaders.get(seg), touchPlaceKnown: touchPlaceKnown(all, i, ctx.raw), cwd: commandCwd(ctx.raw, process.cwd(), { upto: i, shell }) })
    .map((found) => ({ ...found, segment: i })));
}

export const scanShellWrites = (command, options) => scanAllShellWrites(command, options)[0] || null;
