// ssh-remote-mask.mjs — the quoted remote command of an ssh call runs on another machine: its file operands are no local writes.
//
//   maskSshRemote(text) -> string
//     `text` (one segment) with each quoted remote-command word that follows the host of an ssh call replaced by spaces, so a
//     scan reads no cp, sed -i, rm or redirect in it. The length is kept, so positions stay valid. ssh is found where it leads
//     the segment past wrappers (`timeout 5 ssh`) and inside the quoted string of a shell, `eval` or `builds --run` that leads it.
//     Words are cut with backslash escapes honoured; the text comes back whole when its quotes do not balance.
//     Fails closed, text left whole, unless every ssh option is known safe (-i -p -l -q -v -T -t -4 -6 -n) and the host is a plain
//     remote name or address (ssh-local-host.mjs). Also whole: an unquoted remote command, a word after a non-quoted word, a
//     double-quoted word holding an unescaped `$` or backtick, a remote word led by `-`, and an `ssh` that is an operand or a
//     flag's value (`sudo -u ssh`, `sudo -E ssh`).

import { commandName, leadIndex } from './command-lead.mjs';
import { MAX_NESTING } from './lead-command-walk.mjs';
import { runnerTexts, sshCall } from './runner-texts.mjs';
import { isPlainRemoteHost } from './ssh-local-host.mjs';

const SSH_NAME = /^ssh$/i;
const SAFE_OPTION_LETTERS = new Set('ipltvqT46n');
const WORD = /(?:"(?:[^"\\]|\\.)*"|'[^']*'|\\[\s\S]|[^\s"'\\])+/g;
const SINGLE_QUOTED = /^'([^']*)'$/;
const DOUBLE_QUOTED = /^"((?:[^"\\]|\\.)*)"$/;
const ESCAPED_PAIR = /\\./g;
const LOCAL_EXPANSION = /\$|`/;
const DOUBLE_QUOTE_ESCAPE = /\\["\\$`]/;

function wordsWithPositions(text) {
  const words = [...text.matchAll(WORD)].map((m) => ({ token: m[0], at: m.index }));
  return /\S/.test(text.replace(WORD, '')) ? null : words;
}

const blanked = (text, { token, at }) => `${text.slice(0, at)}${' '.repeat(token.length)}${text.slice(at + token.length)}`;

/** The remote command word's body when only the remote shell can expand it: single-quoted, or double-quoted with no unescaped `$` or backtick. */
const remoteBody = ({ token }) => {
  const single = token.match(SINGLE_QUOTED);
  if (single) return single[1];
  const double = token.match(DOUBLE_QUOTED);
  return double && !LOCAL_EXPANSION.test(double[1].replace(ESCAPED_PAIR, '')) ? double[1] : null;
};

/** The text a quoted word hands a nested shell, when it reads the same raw as after the outer shell's unescaping. */
const nestedBody = ({ token }) => {
  const single = token.match(SINGLE_QUOTED);
  if (single) return single[1];
  const double = token.match(DOUBLE_QUOTED);
  return double && !DOUBLE_QUOTE_ESCAPE.test(double[1]) ? double[1] : null;
};

/** The index of an `ssh` word in command position: no flag stands directly before it, as `-u` would make it that flag's value. */
const sshLeadIndex = (tokens) => leadIndex(tokens, (name, rest) => SSH_NAME.test(name) && !tokens[tokens.length - rest.length - 2]?.startsWith('-'));

/** The host index of an ssh call whose every option is known safe and whose host provably names another machine; -1 otherwise. */
function remoteHostIndex(operands) {
  const { host, letters } = sshCall(operands);
  const known = host >= 0 && letters.every((letter) => SAFE_OPTION_LETTERS.has(letter));
  return known && isPlainRemoteHost(operands[host]) ? host : -1;
}

/** A remote word whose body leads with `-` is an option ssh reads after the host, so it is never masked. */
function maskRemote(text, words, sshAt) {
  const host = remoteHostIndex(words.slice(sshAt + 1).map((w) => w.token));
  if (host < 0) return text;
  let out = text;
  for (const word of words.slice(sshAt + host + 2)) {
    const body = remoteBody(word);
    if (body === null || body.startsWith('-')) break;
    out = blanked(out, word);
  }
  return out;
}

function maskNested(text, words, leadAt, depth) {
  const tokens = words.map((w) => w.token);
  let out = text;
  for (const run of runnerTexts(commandName(tokens[leadAt]), tokens.slice(leadAt + 1))) {
    const word = words.slice(leadAt + 1).find((w) => nestedBody(w) === run.text);
    if (!word) continue;
    const inner = maskSshRemote(run.text, depth + 1);
    if (inner !== run.text) out = `${out.slice(0, word.at + 1)}${inner}${out.slice(word.at + 1 + run.text.length)}`;
  }
  return out;
}

export function maskSshRemote(text, depth = 0) {
  const source = String(text);
  const words = wordsWithPositions(source);
  if (!words) return source;
  const tokens = words.map((w) => w.token);
  const sshAt = sshLeadIndex(tokens);
  if (sshAt >= 0) return maskRemote(source, words, sshAt);
  if (depth >= MAX_NESTING) return source;
  const leadAt = leadIndex(tokens, (name, rest) => !SSH_NAME.test(name) && runnerTexts(name, rest).length > 0);
  return leadAt < 0 ? source : maskNested(source, words, leadAt, depth);
}
