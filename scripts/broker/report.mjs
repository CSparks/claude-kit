// report.mjs — print a result for a worker: what happened, and for a miss exactly what to fix.

export function printResult(r, log = console.log) {
  log(`${r.id}${r.revision > 1 ? ` (revision ${r.revision})` : ''} [${r.repo || ''}] → ${r.status}${r.phase ? ` at ${r.phase}` : ''}${r.landed ? ` landed ${r.landed.sha}` : ''}`);
  if (r.message) log(`  ${r.message}`);
  if (r.head) log(`  HEAD ${r.head}${r.base && r.base !== r.head ? ` (submitted on ${r.base})` : ''}`);
  for (const s of r.stale || []) {
    log(`  op ${s.index} ${s.path}: ${s.reason}`);
    for (const c of s.since || []) log(`    since base: ${c}`);
    if (s.excerpt) for (const line of s.excerpt.split('\n')) log(`    | ${line}`);
  }
  for (const g of r.gate || []) log(`  gate ${g.path} [${g.check}]: ${g.msg}`);
  for (const c of r.commands || []) {
    log(`  $ ${c.composed}  → exit ${c.exit} (${c.durationMs}ms)`);
    for (const f of c.foreign || []) log(`    foreign (also fails without the patch): ${f.test} � ${f.reason}`);
    if (c.exit === 0 || (c.foreign || []).length) continue;
    for (const t of c.failedTests || []) log(`    failed test: ${t}`);
    for (const [file, blocks] of Object.entries(c.errors || {})) for (const b of blocks) log(`    ${file}:\n${b.split('\n').map((l) => `      ${l}`).join('\n')}`);
    if (!(c.failedTests || []).length && !Object.keys(c.errors || {}).length) for (const line of c.logTail || []) log(`    | ${line}`);
  }
}
