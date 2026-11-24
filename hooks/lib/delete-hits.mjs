// delete-hits.mjs — the hits of a delete command (`rm`, `del`, `erase`, `unlink`, `Remove-Item`).
//
//   deleteHits(ctx, allArgText) -> [hit]
//     ctx:  the scan context (`hit`, `removals`, `vars`, `shell`), as shell-write-scan.mjs builds it
//     every hit carries `deletes: true`. With `removals` the operands are read after the command's own literal variables
//     expand, and the ones no segment resolves to a file are the caller's `unresolved` hits.
// The operands are every word either reading finds: the shell's (shell-lexer.mjs, substitutions split open) and the
// blind one that splits at every quote and bracket, so a word inside a quoted `$(...)` is judged too. An operand that
// holds a substitution, quoted or not, is unresolved.

import { deleteOperandText, isStatusParameter } from './delete-operands.mjs';
import { lex, words } from './shell-lexer.mjs';
import { expandVariables } from './shell-variables.mjs';

const SUBSTITUTION = /\$\(/;
const BACKTICK = '`';
const RECURSIVE_BASH = /^(?:-[A-Za-z]*[rR][A-Za-z]*|--recursive)$/;
const RECURSIVE_POWERSHELL = /^-r(?:ec[a-z]*)?$/i;
const POWERSHELL_SUBEXPRESSION = /(?:^|\s)@?\(/;

// The path components that decide which files a delete removes: the last one, trailing separators and `.` dropped; all of
// them when the delete is recursive.
function decidingParts(operand, recursive) {
  const parts = operand.split(/[\\/]+/).filter((p) => p !== '' && p !== '.');
  return recursive ? parts : parts.slice(-1);
}

// The delete operands no segment of the command resolves to a file: a variable or substitution left in a deciding
// component, a source-looking name behind a variable, a bash backtick or a PowerShell subexpression.
function unresolvedOperands({ operands, substitutions }, argText, ctx) {
  const power = ctx.shell === 'powershell';
  const recursive = operands.some((o) => (power ? RECURSIVE_POWERSHELL : RECURSIVE_BASH).test(o));
  const substituted = (o) => SUBSTITUTION.test(o) || (!power && o.includes(BACKTICK));
  const open = operands.filter((o) => substituted(o) || (o.includes('$') && (decidingParts(o, recursive).some((p) => p.includes('$')) || ctx.hit(o))));
  const shown = [...open.map((o) => (o === '$' ? '$(...)' : o)), ...Array(substitutions).fill('$(...)')];
  if (!power && argText.includes('`')) shown.push('`...`');
  if (power && POWERSHELL_SUBEXPRESSION.test(argText)) shown.push('(...)');
  return { open, shown };
}

// The operand words of both readings (status parameters dropped) and how many unquoted `$(...)` the text opens.
function fileOperands(text, shell) {
  const { tokens } = lex(text, { shell, flat: true });
  const read = tokens.filter((t) => t.kind === 'word').map((t) => t.literal);
  const blind = words(text, { blind: true }).map((t) => t.raw);
  const operands = [...new Set([...read, ...blind])].filter((w) => !isStatusParameter(w));
  return { operands, substitutions: tokens.filter((t) => t.kind === 'open' && t.op === '$(').length };
}

export function deleteHits(ctx, allArgText) {
  const { hit, removals } = ctx;
  const argText = deleteOperandText(allArgText, ctx.shell);
  const deleting = (h) => ({ ...h, deletes: true });
  if (!removals) return fileOperands(argText, ctx.shell).operands.map(hit).filter(Boolean).map(deleting);
  const found = fileOperands(expandVariables(argText, ctx.vars, ctx.shell), ctx.shell);
  const { operands } = found;
  const { open, shown } = unresolvedOperands(found, argText, ctx);
  return [
    ...operands.filter((o) => !open.includes(o)).map(hit).filter(Boolean).map(deleting),
    ...shown.map((o) => deleting(removals.unresolved(o))),
  ];
}
