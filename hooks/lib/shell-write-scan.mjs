// Finds the hand write in a shell command (redirect, mv/rm/cp, sed -i, a PowerShell cmdlet, `node -e`,
// a heredoc or scratch script) aimed at a path some gate protects. Callers supply the policy:
//
//   scanAllShellWrites(command, { hit, codeHit, readScript, judgeMoveSources, exemptByDestination, shell }) -> every hit
//     shell ('bash' | 'powershell'): the escape rules segments() applies; omitted, any escape before a quote is ambiguous
//   scanShellWrites(command, options) -> the first hit, or null
//     hit(path)     judge one operand path of a writing command or redirect
//     codeHit(code) judge inline code, a heredoc body or a scratch script that writes files
//     readScript(p) the text of a script the command runs ('' when unreadable)
//     judgeMoveSources  judge every operand of a mv (a gate that protects its files from removal)
//     exemptByDestination  a cp/mv whose shape is proven by shell-copy-target.mjs returns its source hits tagged
//       `outsideTo: <destination>`; the CALLER exempts exactly those when the destination lands outside every
//       adopted repo. Any other copy or move judges every operand as a write.
//
// A write tool counts WHEREVER its name appears as a word (`sudo -u root sed -i`, `ssh -i k host tee x`): no wrapper
// is parsed and no text blanked, so a deny gate cannot be steered by how a wrapper takes its options. A segment led by
// a reader or a kit verb is no write tool, but its redirects are judged: a kit or git segment counts only a `>`
// outside quotes (KIT-T951). A node call is judged on every module it loads, except repo and package modules.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { isNodeInlineFlag, nodeLoadedModules, nodeScriptName } from './node-args.mjs';
import { copyTargets } from './shell-copy-target.mjs';
import { blindSegments, segments } from './shell-segments.mjs';

export const KIT_TOOL = /^(?:t|cap|rem|q|code-graph|t\.mjs|cap\.mjs|rem\.mjs|q\.mjs|index-tickets\.mjs|triage\.mjs|code-graph\.mjs)$/i;
const READER = /^(?:grep|egrep|fgrep|rg|ag|ack|cat|less|more|head|tail|wc|ls|stat|file|diff|cmp)$/i;
const WRITING_CMD = /^(?:rm|rd|del|erase|ren|rename|rmdir|unlink|tee|touch|truncate|remove-item|rename-item|new-item|set-content|add-content|out-file|clear-content)$/i;
const MOVE_CMD = /^(?:mv|move-item)$/i;
const COPY_CMD = /^(?:cp|copy|copy-item|install|mv|move-item)$/i;
const IN_PLACE_TOOL = /^(?:sed|perl)$/i;
const IN_PLACE_FLAG = /^(?:-[A-Za-z]*i[A-Za-z]*|--in-place(?:=.*)?)$/;
const INTERPRETER = /^(?:node|python3?|py|powershell|pwsh)$/i;
const INLINE_FLAG = /^(?:-e|--eval|-p|--print|-c|-command)$/i;
const SCRIPT_FILE = /\.(?:m?js|cjs|py|ps1)$/i;
const DATA_URL = /^data:/i;
const WORD = /[^\s'"`;|&()<>]+/g;
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
const wordsIn = (text) => [...text.matchAll(WORD)].map((m) => ({ w: m[0], at: m.index }));
const listed = (found) => [].concat(found || []);

/**
 * The target of every `>` or `>>` in `text`; with `outsideQuotes` a `>` inside a quoted span is skipped. Only text the
 * quoting of which is settled reaches the quote walk, so a backslash outside single quotes escapes the next character.
 */
export function redirectTargets(text, outsideQuotes) {
  const quoted = new Array(text.length).fill(false);
  let open = '';
  for (let i = 0; i < text.length && outsideQuotes; i++) {
    quoted[i] = open !== '' || text[i] === '"' || text[i] === "'";
    if (text[i] === '\\' && open !== "'") { quoted[i + 1] = true; i++; continue; }
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
// destination, for a caller that can show the destination leaves the repo; anything else judges every operand.
function judgeCopy(tool, argText, ctx) {
  const { proven, writes } = copyTargets(tool, argText);
  const { hit } = ctx;
  if (!proven) return writes.map(hit).filter(Boolean);
  const tagged = ctx.exemptByDestination
    ? proven.sources.map(hit).filter(Boolean).map((h) => ({ ...h, outsideTo: proven.destination }))
    : [];
  return [proven.destination, ...proven.under].map(hit).concat(tagged).filter(Boolean);
}

function judgeTool(tool, rest, text, ctx, argText) {
  const { hit, codeHit, readScript } = ctx;
  const operands = rest.map((r) => r.w);
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

const ARG = /(?:"[^"]*"|'[^']*'|[^\s"'])+/g;

/** Whitespace-split arguments with a quoted span kept whole and its quotes dropped. */
export const shellArgs = (text) => [...String(text).matchAll(ARG)].map((m) => m[0].replace(/["']/g, '')).filter(Boolean);

/** True when the segment runs a kit verb: `q ...` or `node [flags] <kit script> ...`, never `node -e <code>` whatever the code names. */
export function kitLed(text) {
  const args = shellArgs(text);
  if (!args.length) return false;
  const leader = nameOf(args[0]);
  return /^node$/i.test(leader) ? KIT_TOOL.test(nodeScriptName(args.slice(1))) : KIT_TOOL.test(leader);
}

function judgeSegment(text, ctx) {
  const words = wordsIn(text);
  if (!words.length) return [];
  const leader = nameOf(words[0].w);
  const quotedArgsInert = kitLed(text) || /^git$/i.test(leader);

  const hits = redirectTargets(text, quotedArgsInert).map(ctx.hit).filter(Boolean);
  if (quotedArgsInert || READER.test(leader)) return hits;
  for (let i = 0; i < words.length; i++) {
    hits.push(...listed(judgeTool(nameOf(words[i].w), words.slice(i + 1), text, ctx, text.slice(words[i].at + words[i].w.length))));
  }
  return hits;
}

/** The text of a script under the temp dir ('' elsewhere or when unreadable): scratch scripts are judged, repo scripts are not. */
export function readTempScript(path) {
  try {
    const abs = resolve(path);
    const rel = relative(resolve(tmpdir()), abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return '';
    return readFileSync(abs, 'utf8');
  } catch { return ''; }
}

const wordsOf = (...patterns) => patterns.map((p) => p.source.slice('^(?:'.length, -')$'.length)).join('|');
const WRITE_TOKEN = new RegExp(`\\b(?:${wordsOf(WRITING_CMD, COPY_CMD, IN_PLACE_TOOL)})\\b|>`, 'i');

// With ambiguous quoting no segment can be trusted: a write-tool word, a `>` or a filesystem write call
// anywhere in the command is a hit, and `ambiguous()` builds the gate's result for it. Pieces cut on every
// operator, quoting ignored, that a kit verb leads are read-only searches: a write token in a `q` pattern is
// not a write, but a redirect in one is still judged by its target, and a write behind an operator is its own
// piece and still tested.
const ambiguousWrite = (text, hit) => {
  const pieces = blindSegments(text);
  const kitPieces = pieces.filter((s) => kitLed(s.text));
  if (kitPieces.some((s) => redirectTargets(s.text, false).some((target) => hit(target)))) return true;
  const rest = pieces
    .filter((s) => !kitPieces.includes(s))
    .map((s) => s.text)
    .join(' ; ');
  return WRITE_TOKEN.test(rest) || FS_WRITE.test(rest);
};

export function scanAllShellWrites(command, { hit, codeHit, readScript = readTempScript, ambiguous, judgeMoveSources = false, exemptByDestination = false, shell = '' }) {
  const parts = segments(String(command || ''), { shell });
  const text = parts.text;
  if (parts.ambiguous && ambiguous) return ambiguousWrite(text, hit) ? [ambiguous()] : [];
  if (HEREDOC_CODE.test(text) || PIPED_CODE.test(text)) return listed(codeHit(text));
  const ctx = { hit, codeHit, readScript, judgeMoveSources, exemptByDestination };
  return [...parts].flatMap((seg) => judgeSegment(seg.text, ctx));
}

export const scanShellWrites = (command, options) => scanAllShellWrites(command, options)[0] || null;
