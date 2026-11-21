// ssh-remote-mask.mjs — the quoted remote command of an ssh call runs on another machine: its file operands are no local writes.
//
//   maskSshRemote(text) -> string
//     `text` (one segment) with each quoted remote-command word that follows the host of an ssh call replaced by spaces, so a
//     scan reads no cp, sed -i, rm or redirect in it. The length is kept, so positions stay valid. ssh is found where it leads
//     the segment past wrappers (`timeout 5 ssh`) and inside the quoted string of a shell, `eval` or `builds --run` that leads it.
//     Left whole: an unquoted remote command, a word after a non-quoted word, a double-quoted word holding `$(` or a backtick
//     (the local shell runs those), and an `ssh` that is an operand of another command.

import { commandName, leadIndex } from './command-lead.mjs';
import { MAX_NESTING } from './lead-command-walk.mjs';
import { runnerTexts, sshHostIndex } from './runner-texts.mjs';
import { WHOLLY_QUOTED, dequoted, shellTokens } from './shell-segments.mjs';

const SSH_NAME = /^ssh$/i;
const LOCAL_EXPANSION = /\$\(|`/;

const wordsWithPositions = (text) => {
  let from = 0;
  return shellTokens(text).map((token) => {
    const at = text.indexOf(token, from);
    from = at + token.length;
    return { token, at };
  });
};

const blanked = (text, { token, at }) => `${text.slice(0, at)}${' '.repeat(token.length)}${text.slice(at + token.length)}`;
const remoteRuns = ({ token }) => WHOLLY_QUOTED.test(token) && !(token.startsWith('"') && LOCAL_EXPANSION.test(token));

function maskRemote(text, words, sshAt) {
  const host = sshHostIndex(words.slice(sshAt + 1).map((w) => w.token));
  if (host < 0) return text;
  let out = text;
  for (const word of words.slice(sshAt + host + 2)) {
    if (!remoteRuns(word)) break;
    out = blanked(out, word);
  }
  return out;
}

function maskNested(text, words, leadAt, depth) {
  const tokens = words.map((w) => w.token);
  let out = text;
  for (const run of runnerTexts(commandName(tokens[leadAt]), tokens.slice(leadAt + 1))) {
    const word = words.slice(leadAt + 1).find((w) => WHOLLY_QUOTED.test(w.token) && dequoted(w.token) === run.text);
    if (!word) continue;
    const inner = maskSshRemote(run.text, depth + 1);
    if (inner !== run.text) out = `${out.slice(0, word.at + 1)}${inner}${out.slice(word.at + 1 + run.text.length)}`;
  }
  return out;
}

export function maskSshRemote(text, depth = 0) {
  const source = String(text);
  const words = wordsWithPositions(source);
  const tokens = words.map((w) => w.token);
  const sshAt = leadIndex(tokens, (name) => SSH_NAME.test(name));
  if (sshAt >= 0) return maskRemote(source, words, sshAt);
  if (depth >= MAX_NESTING) return source;
  const leadAt = leadIndex(tokens, (name, rest) => runnerTexts(name, rest).length > 0);
  return leadAt < 0 ? source : maskNested(source, words, leadAt, depth);
}
