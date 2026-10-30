// report.mjs — print a result for a worker: what happened, and for a miss exactly what to fix. A command prints as
// command-summary.mjs's compact lines (exit, failed tests with panic location, metrics, log path), never a raw log.

import { commandSummary } from './command-summary.mjs';

export function printResult(r, log = console.log) {
  log(`${r.id}${r.revision > 1 ? ` (revision ${r.revision})` : ''} [${r.repo || ''}] → ${r.status}${r.phase ? ` at ${r.phase}` : ''}${r.landed ? ` landed ${r.landed.sha}` : ''}`);
  if (r.message) log(`  ${r.message}`);
  for (const e of r.dirtyEntries || []) log(`  dirty: ${e}`);
  if (r.status === 'dirty') log('  the job stays queued: the broker runs it once the tree is clean (`node broker.mjs status --root <checkout>` names the holder); wait again then');
  for (const f of r.conflict || []) log(`  conflict: ${f}`);
  if (r.head) log(`  HEAD ${r.head}${r.base && r.base !== r.head ? ` (submitted on ${r.base})` : ''}`);
  for (const s of r.stale || []) {
    log(`  op ${s.index} ${s.path}: ${s.reason}${s.hint ? ` (${s.hint})` : ''}`);
    for (const c of s.since || []) log(`    since base: ${c}`);
    if (s.excerpt) for (const line of s.excerpt.split('\n')) log(`    | ${line}`);
  }
  for (const g of r.gate || []) log(`  gate ${g.path} [${g.check}]: ${g.msg}`);
  for (const c of r.commands || []) for (const line of commandSummary(c)) log(line);
}
