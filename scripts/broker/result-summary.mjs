#!/usr/bin/env node
// result-summary.mjs — a job's result as an agent should read it (KIT-D116): the verdict, each command's exit code, each
// failed test with its panic location, the key metric lines and the log path (command-summary.mjs). Read this, not the log.
//
// USE: node result-summary.mjs <job id> --root <build-checkout>      exit 3 = no result for the id yet

import { parseFlags, loadCfg } from './cli.mjs';
import { laneCfgFor } from './lanes.mjs';
import { resultSummary } from './command-summary.mjs';
import { readResult } from './result.mjs';
import { outsideReachOf, reachBases } from './timing-reach.mjs';

const EXIT_NO_RESULT = 3;
const flags = parseFlags(process.argv.slice(2));
const id = flags._[0];
if (!id) {
  console.error('result-summary: a job id is required');
  process.exit(2);
}
const { cfg } = loadCfg(flags);
const result = readResult(laneCfgFor(cfg, id), id);
if (!result) {
  console.error(`result-summary: no result for ${id} yet`);
  process.exit(EXIT_NO_RESULT);
}
console.log(resultSummary(result, { outside: new Set(outsideReachOf(result, reachBases(cfg))) }).join('\n'));
