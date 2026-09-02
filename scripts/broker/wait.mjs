#!/usr/bin/env node
// wait.mjs — block on a job's result with a bounded poll, print it, and exit with the job's
// status so a worker's turn is never left stopped on a background task. exit 0 = passed;
// 1 = failed/conflict/dirty; 2 = timed out.
//
// USE: node wait.mjs <id> --root <build-checkout> [--timeout <s>] [--poll <ms>]

import { parseFlags, loadCfg } from './cli.mjs';
import { readResult, STATUS } from './result.mjs';

const flags = parseFlags(process.argv.slice(2));
const id = flags._[0];
if (!id) {
  console.error('wait: a job id is required');
  process.exit(2);
}
const { cfg } = loadCfg(flags);
const timeoutMs = (Number(flags.timeout) || 900) * 1000;
const pollMs = Number(flags.poll) || cfg.pollMs;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deadline = Date.now() + timeoutMs;
while (Date.now() < deadline) {
  const result = readResult(cfg, id);
  if (result) {
    report(result);
    process.exit(result.status === STATUS.PASSED ? 0 : 1);
  }
  await sleep(pollMs);
}
console.error(`wait: timed out after ${timeoutMs / 1000}s waiting for ${id}`);
process.exit(2);

function report(r) {
  console.log(`${r.id} [${r.repo} ${r.branch}] → ${r.status}${r.landed ? ` landed ${r.landed.sha}` : ''}`);
  if (r.message) console.log(`  ${r.message}`);
  if (r.conflicts && r.conflicts.length) console.log(`  conflicts: ${r.conflicts.join(', ')}`);
  for (const c of r.commands || []) {
    console.log(`  $ ${c.composed}  → exit ${c.exit} (${c.durationMs}ms)`);
    if (c.exit !== 0) for (const line of c.logTail || []) console.log(`    | ${line}`);
  }
}
