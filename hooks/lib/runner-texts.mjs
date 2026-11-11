// runner-texts.mjs — the command strings a command runs from its own operands.
//
//   runnerTexts(name, rest, { shell, blind }) -> [{ text, shell }]
//     the strings `name` runs from its operands `rest`, each with the shell it is written for: a shell's `-c` string,
//     `eval`, `su -c`, every clause of a `find -exec`, the remote command of `ssh`, the string of a `trap`. With `blind`
//     (words cut on whitespace and quotes) a string operand arrives as several words, so every word after the lead is taken.

import { dequoted } from './shell-segments.mjs';

const SH_NAME = /^(?:bash|sh|zsh|dash|ksh|ash)$/i;
const SH_C_FLAG = /^-[A-Za-z]*c[A-Za-z]*$/;
const SH_VALUE_FLAG = /^[-+][oO]$/;
const PS_NAME = /^(?:pwsh|powershell)$/i;
const PS_C_FLAG = /^-(?:c|command)$/i;
const SU_NAME = /^(?:su|runuser)$/i;
const SU_C_FLAG = /^(?:--command|-[A-Za-z]*c[A-Za-z]*)$/;
const FIND_NAME = /^find$/i;
const FIND_EXEC_FLAG = /^-(?:exec|execdir|ok|okdir)$/;
const FIND_CLAUSE_END = /^(?:\\?;|\+)$/;
const SSH_NAME = /^ssh$/i;
const SSH_VALUE_FLAG = /^-[BbcDEeFIiJLlmOoPpQRSWw]$/;
const TRAP_NAME = /^trap$/i;
const TRAP_FLAG = /^(?:--|-[lp]+)$/;

/** Where the command text a shell runs begins in `rest` (the words after the shell's name): after `-c`, `-Command` or `eval`; -1 when it runs none. */
function innerStart(name, rest) {
  if (/^eval$/i.test(name)) return 0;
  if (SH_NAME.test(name)) {
    for (let i = 0; i < rest.length && rest[i].startsWith('-'); i++) {
      if (SH_C_FLAG.test(rest[i])) return i + 1 < rest.length ? i + 1 : -1;
      if (SH_VALUE_FLAG.test(rest[i])) i++;
    }
    return -1;
  }
  const at = PS_NAME.test(name) ? rest.findIndex((w) => PS_C_FLAG.test(w)) : -1;
  return at >= 0 && at + 1 < rest.length ? at + 1 : -1;
}

const findClauses = (rest) => rest.flatMap((word, i) => {
  if (!FIND_EXEC_FLAG.test(word)) return [];
  const end = rest.findIndex((w, j) => j > i && FIND_CLAUSE_END.test(dequoted(w)));
  return [rest.slice(i + 1, end < 0 ? rest.length : end).join(' ')];
});

/** The words after ssh's options and host: the remote command. */
function sshOperands(rest) {
  for (let i = 0; i < rest.length; i++) {
    if (SSH_VALUE_FLAG.test(rest[i])) i++;
    else if (!rest[i].startsWith('-')) return rest.slice(i + 1);
  }
  return [];
}

export function runnerTexts(name, rest, { shell = '', blind = false } = {}) {
  const whole = (words) => (blind || words.length !== 1 ? words.join(' ') : dequoted(words[0]));
  if (FIND_NAME.test(name)) return findClauses(rest).map((text) => ({ text, shell }));
  if (SSH_NAME.test(name)) return [sshOperands(rest)].filter((ops) => ops.length).map((ops) => ({ text: whole(ops), shell: 'bash' }));
  if (TRAP_NAME.test(name)) return [rest.filter((w) => !TRAP_FLAG.test(w))].filter((ops) => ops.length).map((ops) => ({ text: blind ? ops.join(' ') : dequoted(ops[0]), shell: 'bash' }));
  if (SU_NAME.test(name)) {
    const at = rest.findIndex((w) => SU_C_FLAG.test(w));
    return at >= 0 && at + 1 < rest.length ? [{ text: whole(rest.slice(at + 1, blind ? undefined : at + 2)), shell: 'bash' }] : [];
  }
  const start = innerStart(name, rest);
  if (start < 0) return [];
  const operands = rest.slice(start);
  const isEval = /^eval$/i.test(name);
  const text = blind ? operands.join(' ') : isEval ? operands.map(dequoted).join(' ') : dequoted(operands[0]);
  return [{ text, shell: PS_NAME.test(name) ? 'powershell' : isEval ? shell : 'bash' }];
}
