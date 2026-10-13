// q-fts-extras.mjs — what `q fts` prints beneath the item hits: doc/config lines holding every
// term (when no item answered in full) and the code definitions the terms name. Items are
// only part of what an agent greps for; these sections keep the grep unnecessary.

import { ftsCodeDefs, ftsDocLines } from './code-index-query.mjs';
import { printRows } from './q-print.mjs';

/** Print the sections for `queryText`; `itemsFull` is false when no item held every term. */
export async function printFtsExtras(queryText, cwdRoot, itemsFull) {
  if (!itemsFull) await section('also in docs/config (q code):', await ftsDocLines(queryText, cwdRoot));
  await section('also in code (q sym):', await ftsCodeDefs(queryText, cwdRoot));
}

async function section(title, rows) {
  if (!rows.length) return;
  process.stdout.write(`${title}\n`);
  printRows(rows, false);
}
