// delete-hits.mjs — the hits of a delete command (`rm`, `del`, `erase`, `unlink`, `Remove-Item`).
//
//   deleteHits(ctx, allArgText) -> [hit]
//     ctx:  the scan context (`hit`, `removals`, `vars`, `shell`), as shell-write-scan.mjs builds it
//     every hit carries `deletes: true`. With `removals` the operands are read after the command's own literal variables
//     expand, and the ones no segment resolves to a file are the caller's `unresolved` hits.

import { deleteOperandText, isStatusParameter } from './delete-operands.mjs';
import { expandVariables } from './shell-variables.mjs';
import { wordsIn } from './shell-words.mjs';

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
function unresolvedOperands(operands, argText, ctx) {
  const power = ctx.shell === 'powershell';
  const recursive = operands.some((o) => (power ? RECURSIVE_POWERSHELL : RECURSIVE_BASH).test(o));
  const open = operands.filter((o) => o.includes('$') && (decidingParts(o, recursive).some((p) => p.includes('$')) || ctx.hit(o)));
  const shown = open.map((o) => (o === '$' ? '$(...)' : o));
  if (!power && argText.includes('`')) shown.push('`...`');
  if (power && POWERSHELL_SUBEXPRESSION.test(argText)) shown.push('(...)');
  return { open, shown };
}

export function deleteHits(ctx, allArgText) {
  const { hit, removals } = ctx;
  const argText = deleteOperandText(allArgText, ctx.shell);
  const deleting = (h) => ({ ...h, deletes: true });
  const fileOperands = (text) => wordsIn(text).map((x) => x.w).filter((w) => !isStatusParameter(w));
  if (!removals) return fileOperands(argText).map(hit).filter(Boolean).map(deleting);
  const operands = fileOperands(expandVariables(argText, ctx.vars, ctx.shell));
  const { open, shown } = unresolvedOperands(operands, argText, ctx);
  return [
    ...operands.filter((o) => !open.includes(o)).map(hit).filter(Boolean).map(deleting),
    ...shown.map((o) => deleting(removals.unresolved(o))),
  ];
}
