// t/red-by-design.mjs — `t red-by-design add|remove|list`: the named-debt test list the red-test-dispatch gate reads
// (hooks/lib/red-by-design.mjs). Pure file mutation; t-verbs.mjs routes here.
//
//   runRedByDesign(root, rest, flags) -> the line to print; throws Error(message) on a refusal

import { relative } from 'node:path';
import { STALE_DAYS, ageDays, readEntries, removeEntry, writeEntry } from '../../hooks/lib/red-by-design.mjs';

export const RED_USAGE = 't red-by-design add <test> --decided-by <id,...> --reason "<one line>" [--owner <who>|unsigned] (adds, or renews the date) | remove <test> | list';

const listLine = (e) => `${e.test} (${ageDays(e)}d${ageDays(e) > STALE_DAYS ? ', stale' : ''}) ${e.decidedBy.join(', ')}; fix: ${e.owner}; ${e.reason}`;

export function runRedByDesign(root, rest, flags = {}) {
  const [action, ...words] = rest;
  const test = words.join(' ');
  if (action === 'list') {
    const entries = readEntries(root);
    return entries.length ? entries.map(listLine).join('\n') : 'red-by-design: no entries';
  }
  if (action === 'add' && test) {
    const r = writeEntry(root, { test, decidedBy: flags.decidedBy || [], reason: flags.reason, owner: flags.owner });
    return `red-by-design: ${test} ${r.replaced ? 'renewed' : 'added'} -> ${relative(root, r.file)} (${r.date})`;
  }
  if (action === 'remove' && test) {
    const r = removeEntry(root, test);
    return `red-by-design: ${test} removed (${relative(root, r.file)})`;
  }
  throw new Error('usage');
}
