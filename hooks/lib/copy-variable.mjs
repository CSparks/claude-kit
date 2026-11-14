// What source-shell-gate says when a cp or mv names a variable the command does not resolve (shell-variables.mjs): which
// variable, why it stayed unresolved and how to write the command so it resolves.
//
//   copyVariable(tool, expandedArgText, parts, index, visible, shell) -> { tool, operand, name, reason } | null
//     the last operand of the call that still holds a `$NAME` after the command's own literal variables expanded
//   copyVariableAdvice(found, shell) -> text   one block-text paragraph for a copyVariable result; '' for none

import { dequoted, shellTokens } from './shell-segments.mjs';
import { UNRESOLVED as U, whyUnresolved } from './shell-variables.mjs';

const REFERENCE = /\$(?:\{([A-Za-z_]\w*)[^}]*\}|([A-Za-z_]\w*))/;

const WHY = {
  [U.unassigned]: (v) => `${v} is not assigned in this command. An earlier command or the environment may hold it, but this gate sees neither.`,
  [U.exported]: (v) => `${v} is only exported by name here, so its value comes from outside this command, which this gate cannot see.`,
  [U.pipe]: (v) => `${v} is assigned in a pipeline. Each stage of a pipe runs in its own subshell, so the assignment never reaches the copy.`,
  [U.chain]: (v) => `${v} is assigned inside an && chain (behind a cd, say), and a ; or || between that chain and the copy ends it, so the copy runs outside the chain that holds the assignment.`,
  [U.conditional]: (v) => `${v} is assigned behind || or &, so the assignment may not have run when the copy does.`,
  [U.later]: (v) => `${v} is assigned after the copy that reads it.`,
  [U.repeated]: (v) => `${v} is assigned more than once in this command, so no single value is known.`,
  [U.embedded]: (v) => `${v} is assigned only inside another command (a prefix of a command, read, a for loop), which the copy does not see.`,
  [U.owned]: (v) => `${v} is a name the shell rewrites itself (PWD, RANDOM and the like), so its value is never fixed.`,
  [U.impure]: (v) => `${v} is assigned a value that is no plain literal (it holds a substitution, another variable or a tilde).`,
  [U.untrusted]: (v) => `${v} is assigned, but another part of this command may rebind variables (an unknown command, a substitution or ambiguous quoting), so no assignment in it is trusted.`,
  [U.visible]: (v) => `${v} is assigned a value with a space or a glob character, which the shell splits or expands when it is not in double quotes.`,
};

const HOW = {
  bash: 'Write the path out as a literal, or assign it at the front of the command and join the copy to it with && (NAME=/literal/dir && cp <source> "$NAME/<file>").',
  powershell: "Write the path out as a literal, or assign it as one literal before the copy ($NAME = 'C:/literal/dir'; Copy-Item <source> \"$NAME/<file>\").",
  quote: 'Write the operand in double quotes ("$NAME/<file>").',
};

export function copyVariable(tool, argText, parts, index, visible, shell) {
  const operands = shellTokens(argText).filter((t) => !/^[-–—―]/.test(t) && !t.startsWith("'"));
  const operand = operands.map(dequoted).filter((t) => REFERENCE.test(t)).at(-1);
  if (!operand) return null;
  const [, braced, bare] = REFERENCE.exec(operand);
  const name = braced || bare;
  return { tool, operand, name, reason: whyUnresolved(parts, index, name, shell, visible) };
}

export function copyVariableAdvice(found, shell) {
  if (!found) return '';
  const variable = `$${found.name}`;
  const how = found.reason === U.visible ? HOW.quote : HOW[shell === 'powershell' ? 'powershell' : 'bash'];
  return `  This ${found.tool} names ${found.operand}: ${WHY[found.reason](variable)}\n  ${how.replaceAll('NAME', found.name)} A variable the gate cannot resolve leaves the copy judged as a write to the source file.\n`;
}
