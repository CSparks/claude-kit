#!/usr/bin/env node
// wait.mjs — block on a job's result with a bounded poll, print it, and exit with the job's
// status so a worker's turn is never left stopped on a background task. exit 0 = passed or landed;
// 1 = failed/stale/gate/conflict/dirty; 2 = timed out. A result older than the job's current
// inflight run is a previous attempt's and is not final.
//
// A heartbeat line (heartbeat.mjs: queue position, or running time and command) goes to stderr
// every --heartbeat seconds (default 60; 0 = off).
//
// USE: node wait.mjs <id> --root <build-checkout> [--timeout <s>] [--poll <ms>] [--grace-ms <ms>] [--heartbeat <s>]
// (--grace-ms: how long no broker may be seen before wait says so; default 10000, a restart's gap)

import { parseFlags, loadCfg } from './cli.mjs';
import { isCurrentResult } from './current.mjs';
import { listQueue, readResult, STATUS } from './result.mjs';
import { printResult } from './report.mjs';
import { NO_BROKER_GRACE_MS, noBrokerWarning } from './ensure.mjs';
import { observedLive } from './lock.mjs';
import { announce, selfCheck } from './health.mjs';
import { heartbeatLine } from './heartbeat.mjs';

// Bash caps a foreground call at 600 s; 540 leaves room to print the queue position.
const DEFAULT_TIMEOUT_S = 540;
const DEFAULT_HEARTBEAT_S = 60;
const flags = parseFlags(process.argv.slice(2));
const id = flags._[0];
if (!id) {
  console.error('wait: a job id is required');
  process.exit(2);
}
const { cfg } = loadCfg(flags);
const timeoutMs = (Number(flags.timeout) || DEFAULT_TIMEOUT_S) * 1000;
const pollMs = Number(flags.poll) || cfg.pollMs;
const graceMs = flags['grace-ms'] === undefined ? NO_BROKER_GRACE_MS : Number(flags['grace-ms']);
const beatMs = (flags.heartbeat === undefined ? DEFAULT_HEARTBEAT_S : Number(flags.heartbeat)) * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deadline = Date.now() + timeoutMs;
let warned = false;
let missingSince = null;
const said = new Set();
let nextBeat = Date.now() + beatMs;
while (Date.now() < deadline) {
  const result = readResult(cfg, id);
  if (result && isCurrentResult(cfg, result)) {
    printResult(result);
    process.exit(result.status === STATUS.PASSED || result.status === STATUS.LANDED ? 0 : 1);
  }
  const missingForMs = missingSince === null ? 0 : Date.now() - missingSince;
  const warning = warned ? null : noBrokerWarning(cfg, id, { missingForMs, graceMs });
  missingSince = observedLive(cfg) ? null : (missingSince ?? Date.now());
  if (warning) { console.error(warning); warned = true; }
  announce(selfCheck(cfg, { skipNoDaemon: missingSince === null || Date.now() - missingSince < graceMs }).entries, said);
  if (beatMs > 0 && Date.now() >= nextBeat) {
    const line = heartbeatLine(cfg, id);
    if (line) console.error(line);
    nextBeat = Date.now() + beatMs;
  }
  await sleep(pollMs);
}
const position = listQueue(cfg).findIndex((j) => j.id === id);
const where = heartbeatLine(cfg, id);
const alive = observedLive(cfg) && where;
console.error(`wait: timed out after ${timeoutMs / 1000}s waiting for ${id}${position >= 0 ? ` (queue position ${position + 1})` : ''}${alive ? `; the daemon is alive and the job is ${where.replace(/^wait: \S+ /, '')}: run wait again, do not withdraw it` : ''}`);
process.exit(2);
