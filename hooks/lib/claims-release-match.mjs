// claims-release-match.mjs — what a shell command says about `claims --release` (KIT-T1288), read from the repo's shell tokens
// (shell-segments.mjs), never from one regex over the text.
//
//   namesRelease(command, toolName) -> true when a SUBAGENT's command must be refused: a de-quoted token names the claims
//        script or shim AND a `--release` word appears anywhere (inside the quoted body of `bash -c`, `node -e`, `eval`,
//        `builds --run` too), or any token names the release functions or the stamp (they carry no flag to wait for).
//        A command that cannot be paired into quotes is judged word by word. A lone echo/printf/q/t/cap/rem segment with no
//        command substitution only prints its words and passes.
//   releaseTarget(command, toolName) -> the agent id the main thread's plain `claims --release <id>` names, or ''
//
// A token is split on separators and path slashes (both slash ways, and with backslashes removed as an escape) so
// `X=scripts/claims.mjs`, `"D:\kit\claims.cmd"`, `import('claims.mjs').then` and `cl\aims` all show their `claims` word;
// `agent-claims.mjs` does not.

import { segments, shellOfTool, shellTokens, unquoteSpans } from './shell-segments.mjs';
import { STAMP_ENV } from './claims-stamp.mjs';

const CLAIMS_NAME = /^claims$/i;
const HARD_NAME = new RegExp(`^(?:releaseDead|releaseAgent|${STAMP_ENV}|claims-stamps)$`, 'i');
const RELEASE_FLAG = /^--release$/i;
const SEPARATORS = /[\s/.=:,;(){}$<>|&@!*?[\]]+/;
const QUOTE_MARKS = /["'`^]/g;
const INERT_COMMANDS = new Set(['echo', 'printf', 'q', 't', 'cap', 'rem']);
const SUBSTITUTION = /\$\(|`|[<>]\(/;
const COMMAND_EXTENSION = /\.(?:exe|cmd)$/i;

function pieces(token) {
  const word = unquoteSpans(token).replace(QUOTE_MARKS, '');
  return [word.replace(/\\/g, '/'), word.replace(/\\/g, '')].flatMap((v) => v.split(SEPARATORS).filter(Boolean));
}

const commandWord = (tokens) => unquoteSpans(tokens[0] || '').replace(/\\/g, '/').split('/').pop().replace(COMMAND_EXTENSION, '').toLowerCase();

function judged(words) {
  return words.some((w) => HARD_NAME.test(w)) || (words.some((w) => CLAIMS_NAME.test(w)) && words.some((w) => RELEASE_FLAG.test(w)));
}

export function namesRelease(command, toolName) {
  const text = String(command || '');
  const segs = segments(text, { shell: shellOfTool(toolName) });
  if (segs.ambiguous) return judged(text.split(/\s+/).flatMap(pieces));
  const tokenSets = segs.map((s) => shellTokens(s.text));
  if (segs.length === 1 && INERT_COMMANDS.has(commandWord(tokenSets[0])) && !SUBSTITUTION.test(segs[0].text)) return false;
  return judged(tokenSets.flat().flatMap(pieces));
}

export function releaseTarget(command, toolName) {
  const segs = segments(String(command || ''), { shell: shellOfTool(toolName) });
  if (segs.ambiguous) return '';
  for (const { text } of segs) {
    const tokens = shellTokens(text).map(unquoteSpans);
    const at = tokens.findIndex((t) => pieces(t).some((w) => CLAIMS_NAME.test(w)));
    const flag = at < 0 ? -1 : tokens.findIndex((t, i) => i > at && RELEASE_FLAG.test(t));
    const id = flag < 0 ? '' : tokens[flag + 1] || '';
    if (id && !id.startsWith('--')) return id;
  }
  return '';
}
