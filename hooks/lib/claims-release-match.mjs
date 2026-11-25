// claims-release-match.mjs — what a shell command says about `claims --release` (KIT-T1288, KIT-T1537), read from the repo's
// shell tokens (shell-segments.mjs), never from one regex over the text.
//
//   namesRelease(command, toolName) -> true when a SUBAGENT's command must be refused: a `--release` word appears and the
//        command INVOKES the claims script or shim (see below), or any word names the release functions or the stamp (they
//        carry no flag to wait for). A command that cannot be paired into quotes is judged on its blind segments, the flag
//        in the invoking segment.
//        A lone echo/printf/q/t/cap/rem segment with no command substitution only prints its words and passes.
//   releaseTarget(command, toolName) -> the agent id the main thread's plain `claims --release <id>` names, or ''
//   printsOnly(segs)                 -> the lone print-command rule above, shared with hook-entries.mjs
//
// A command invokes claims when a segment's command word (after assignments, `&`, wrappers such as sudo/env and a
// substitution opener) names it, when the script argument of node/bun/deno/python names it, when a quoted body of a shell
// launcher (`bash -c`, `eval`, `builds --run`) or a substitution (`$(..)`, backticks outside single quotes) invokes it, or
// when a code string (`node -e`) or a pipe into a shell holds a `claims` word. An argument that merely spells the word
// (`cargo test --test claims`, a commit message, a crate name) invokes nothing. A variable assigned a claims path counts.
//
// A token is split on separators and path slashes (both slash ways, and with backslashes removed as an escape) so
// `X=scripts/claims.mjs`, `"D:\kit\claims.cmd"` and `cl\aims` all show their `claims` word; `agent-claims.mjs` does not.

import { blindSegments, segments, shellOfTool, shellTokens, unquoteSpans, WHOLLY_QUOTED } from './shell-segments.mjs';
import { STAMP_ENV } from './claims-stamp.mjs';

const CLAIMS_NAME = /^claims$/i;
const HARD_NAME = new RegExp(`^(?:releaseDead|releaseAgent|${STAMP_ENV}|claims-stamps)$`, 'i');
const RELEASE_FLAG = /^--release$/i;
const SEPARATORS = /[\s/.=:,;(){}$<>|&@!*?[\]]+/;
const QUOTE_MARKS = /["'`^]/g;
const INERT_COMMANDS = new Set(['echo', 'printf', 'q', 't', 'cap', 'rem']);
const SUBSTITUTION = /\$\(|`|[<>]\(/;
const COMMAND_EXTENSION = /\.(?:exe|cmd)$/i;
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const OPENER = /^(?:\$\(|[(`{]|[<>]\()+/;
const SUBSTITUTION_BODY = /\$\(([^)]*)\)|`([^`]*)`/g;
const SINGLE_QUOTED = /'[^']*'/g;
const CODE_FLAG = /^(?:-e|--eval|-p|--print|-c)$/i;
const WRAPPERS = new Set(['env', 'sudo', 'time', 'nohup', 'exec', 'command', 'call', 'start', 'xargs']);
const INTERPRETERS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'powershell', 'pwsh', 'cmd', 'eval', 'builds', 'iex', 'invoke-expression']);
const RUNTIMES = new Set(['node', 'nodejs', 'bun', 'deno', 'python', 'python3', 'py', 'perl', 'ruby']);
const MAX_DEPTH = 3;
const LOOSE = -1;

function pieces(token) {
  const word = unquoteSpans(token).replace(QUOTE_MARKS, '');
  return [word.replace(/\\/g, '/'), word.replace(/\\/g, '')].flatMap((v) => v.split(SEPARATORS).filter(Boolean));
}

const commandWord = (tokens) => unquoteSpans(tokens[0] || '').replace(/\\/g, '/').split('/').pop().replace(COMMAND_EXTENSION, '').toLowerCase();
const namesClaims = (token) => pieces(token).some((w) => CLAIMS_NAME.test(w));
const quotedBody = (token) => (WHOLLY_QUOTED.test(token) && /\s/.test(token) ? token.slice(1, -1) : '');

/** True when the parsed command is one echo/printf/q/t/cap/rem segment with no command substitution: it only prints. */
export const printsOnly = (segs) => segs.length === 1 && INERT_COMMANDS.has(commandWord(shellTokens(segs[0].text))) && !SUBSTITUTION.test(segs[0].text);

// The claims invocations of one segment's tokens from `start`: `{ tokens, at }`, `at` LOOSE for a code string.
function invocationsAt(tokens, start, ctx) {
  const word = (k) => (k === start ? tokens[k].replace(OPENER, '') : tokens[k]);
  let i = start;
  while (i < tokens.length && (['', '&'].includes(unquoteSpans(word(i))) || ASSIGNMENT.test(unquoteSpans(word(i))))) i++;
  if (i >= tokens.length) return;
  const lead = word(i);
  if (namesClaims(lead)) { ctx.found.push({ tokens: tokens.map((t, k) => word(k)), at: i }); return; }
  const base = commandWord([lead]);
  const rest = tokens.slice(i + 1);
  if (INTERPRETERS.has(base)) {
    const bodies = rest.map(quotedBody).filter(Boolean);
    if (bodies.length) bodies.forEach((body) => scan(body, ctx));
    else { const next = rest.findIndex((t) => !t.startsWith('-') && !ASSIGNMENT.test(unquoteSpans(t))); if (next >= 0) invocationsAt(tokens, i + 1 + next, ctx); }
  } else if (WRAPPERS.has(base)) {
    const next = rest.findIndex((t) => !t.startsWith('-') && !ASSIGNMENT.test(unquoteSpans(t)));
    if (next >= 0) invocationsAt(tokens, i + 1 + next, ctx);
  } else if (RUNTIMES.has(base)) {
    const code = rest.findIndex((t) => CODE_FLAG.test(t));
    if (code >= 0) { if (rest.slice(code + 1).some(namesClaims)) ctx.found.push({ tokens, at: LOOSE }); return; }
    const script = rest.findIndex((t) => !t.startsWith('-'));
    if (script >= 0 && namesClaims(rest[script])) ctx.found.push({ tokens, at: i + 1 + script });
  }
}

function scan(text, ctx) {
  if (ctx.depth >= MAX_DEPTH) return;
  const inner = { ...ctx, depth: ctx.depth + 1 };
  const segs = segments(text, { shell: ctx.shell });
  const parts = segs.ambiguous ? blindSegments(text) : segs;
  for (const seg of parts) {
    const tokens = segs.ambiguous ? seg.text.split(/\s+/).filter(Boolean) : shellTokens(seg.text);
    const starts = [0, ...tokens.flatMap((t, k) => (k > 0 && OPENER.test(t) ? [k] : []))];
    starts.forEach((k) => invocationsAt(tokens, k, inner));
    for (const m of seg.text.replace(SINGLE_QUOTED, '').matchAll(SUBSTITUTION_BODY)) scan(m[1] ?? m[2], inner);
    if (seg.after === '|' && (INTERPRETERS.has(commandWord(tokens)) || RUNTIMES.has(commandWord(tokens))) && text.split(/\s+/).some(namesClaims)) ctx.found.push({ tokens, at: LOOSE });
  }
}

const invocations = (command, toolName) => { const ctx = { shell: shellOfTool(toolName), depth: 0, found: [] }; scan(String(command || ''), ctx); return ctx.found; };

// A variable assigned a path that names claims: `S=scripts/claims.mjs; node "$S" --release`.
const assignsClaims = (tokens) => tokens.some((t) => ASSIGNMENT.test(unquoteSpans(t)) && namesClaims(unquoteSpans(t).replace(ASSIGNMENT, '')));

export function namesRelease(command, toolName) {
  const text = String(command || '');
  const segs = segments(text, { shell: shellOfTool(toolName) });
  if (!segs.ambiguous && printsOnly(segs)) return false;
  const tokens = segs.ambiguous ? text.split(/\s+/) : segs.map((s) => shellTokens(s.text)).flat();
  const words = tokens.flatMap(pieces);
  if (words.some((w) => HARD_NAME.test(w))) return true;
  if (!words.some((w) => RELEASE_FLAG.test(w))) return false;
  const found = invocations(text, toolName);
  // Blind segments split inside quotes, so an unpaired line needs the flag in the invocation's own segment.
  if (segs.ambiguous) return found.some((inv) => inv.tokens.flatMap(pieces).some((w) => RELEASE_FLAG.test(w)));
  return assignsClaims(tokens) || found.length > 0;
}

export function releaseTarget(command, toolName) {
  const segs = segments(String(command || ''), { shell: shellOfTool(toolName) });
  if (segs.ambiguous) return '';
  for (const { tokens: found, at } of invocations(command, toolName)) {
    if (at === LOOSE) continue;
    const tokens = found.map(unquoteSpans);
    const flag = tokens.findIndex((t, i) => i > at && RELEASE_FLAG.test(t));
    const id = flag < 0 ? '' : tokens[flag + 1] || '';
    if (id && !id.startsWith('--')) return id;
  }
  return '';
}
