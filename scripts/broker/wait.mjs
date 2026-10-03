#!/usr/bin/env node
// wait.mjs — block on a job's result with a bounded poll, print it, and exit with the job's
// status so a worker's turn is never left stopped on a background task. exit 0 = passed or landed;
// 1 = failed/stale/gate/conflict/dirty; 2 = timed out. A result older than the job's current
// inflight run is a previous attempt's and is not final.
//
// USE: node wait.mjs <id> --root <build-checkout> [--timeout <s>] [--poll <ms>]

import { parseFlags, loadCfg } from './cli.mjs';
import { isCurrentResult } from './current.mjs';
import { listQueue, readResult, STATUS } from './result.mjs';
import { printResult } from './report.mjs';
import { noBrokerWarning } from './ensure.mjs';
import { announce, selfCheck } from './health.mjs';

// Bash caps a foreground call at 600 s; 540 leaves room to print the queue position.
const DEFAULT_TIMEOUT_S = 540;
const flags = parseFlags(process.argv.slice(2));
const id = flags._[0];
if (!id) {
  console.error('wait: a job id is required');
  process.exit(2);
}
const { cfg } = loadCfg(flags);
const timeoutMs = (Number(flags.timeout) || DEFAULT_TIMEOUT_S) * 1000;
const pollMs = Number(flags.poll) || cfg.pollMs;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deadline = Date.now() + timeoutMs;
let warned = false;
const said = new Set();
while (Date.now() < deadline) {
  const result = readResult(cfg, id);
  if (result && isCurrentResult(cfg, result)) {
    printResult(result);
    process.exit(result.status === STATUS.PASSED || result.status === STATUS.LANDED ? 0 : 1);
  }
  const warning = warned ? null : noBrokerWarning(cfg, id);
  if (warning) { console.error(warning); warned = true; }
  announce(selfCheck(cfg).entries, said);
  await sleep(pollMs);
}
const position = listQueue(cfg).findIndex((j) => j.id === id);
console.error(`wait: timed out after ${timeoutMs / 1000}s waiting for ${id}${position >= 0 ? ` (queue position ${position + 1})` : ''}`);
process.exit(2);
