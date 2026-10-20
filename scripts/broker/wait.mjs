#!/usr/bin/env node
// wait.mjs — block on a job's result with a bounded poll, print it, and exit with the job's
// status so a worker's turn is never left stopped on a background task. exit 0 = passed or landed;
// 1 = failed/stale/gate/conflict/dirty; 2 = timed out (the job is still queued or running: wait again). A result older than the job's current
// inflight run is a previous attempt's and is not final.
//
// A heartbeat line (heartbeat.mjs: queue position, or running time and command) goes to stderr
// every --heartbeat seconds (default 60; 0 = off).
//
// USE: node wait.mjs <id> --root <build-checkout> [--timeout <s>] [--poll <ms>] [--grace-ms <ms>] [--heartbeat <s>]
// exit 3 = the id is unknown (not queued, running or resulted). A --root naming a submodule maps to its lane (root-map.mjs).
// (--grace-ms: how long no broker may be seen before wait says so; default 10000, a restart's gap)

import { parseFlags, loadCfg } from './cli.mjs';
import { laneCfgFor } from './lanes.mjs';
import { join } from 'node:path';
import { isCurrentResult } from './current.mjs';
import { brokerPaths } from './config.mjs';
import { listQueue, readResult, STATUS } from './result.mjs';
import { inflightHas, readInflight } from './preimage.mjs';
import { printResult } from './report.mjs';
import { IDLE_EXIT_MIN, NO_BROKER_GRACE_MS, ensureBroker, noBrokerWarning, spawnBroker } from './ensure.mjs';
import { observedLive } from './lock.mjs';
import { announce, selfCheck } from './health.mjs';
import { heartbeatLine } from './heartbeat.mjs';
import { restartIfWedged } from './stall.mjs';
import { holdAge, holdLine, holdReport } from './hand-hold.mjs';

// A foreground Bash call with no timeout argument is killed at 120 s (exit 137, no output): the default
// ends the wait first, with exit 2 and the queue position. A longer wait names --timeout (up to 540) and
// runs with the Bash tool's timeout raised to 600000, or in the background.
const DEFAULT_TIMEOUT_S = 100;
const DEFAULT_HEARTBEAT_S = 60;
const flags = parseFlags(process.argv.slice(2));
const id = flags._[0];
if (!id) {
  console.error('wait: a job id is required');
  process.exit(2);
}
const { root, cfg: rootCfg } = loadCfg(flags);
const timeoutMs = (Number(flags.timeout) || DEFAULT_TIMEOUT_S) * 1000;
const pollMs = Number(flags.poll) || rootCfg.pollMs;
const graceMs = flags['grace-ms'] === undefined ? NO_BROKER_GRACE_MS : Number(flags['grace-ms']);
const beatMs = (flags.heartbeat === undefined ? DEFAULT_HEARTBEAT_S : Number(flags.heartbeat)) * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const resultPath = (c) => join(brokerPaths(c).results, `${id}.json`);
const known = (c) => listQueue(c).some((j) => j.id === id) || readResult(c, id) || inflightHas(readInflight(c), id);
if (!known(laneCfgFor(rootCfg, id))) {
  console.error(`wait: unknown job ${id}: not queued, running or resulted under ${brokerPaths(laneCfgFor(rootCfg, id)).home} (root ${root}); check the id and --root`);
  process.exit(3);
}

const deadline = Date.now() + timeoutMs;
let warned = false;
let missingSince = null;
const said = new Set();
let nextBeat = Date.now() + beatMs;
while (Date.now() < deadline) {
  const cfg = laneCfgFor(rootCfg, id);
  const result = readResult(cfg, id);
  if (result && isCurrentResult(cfg, result)) {
    printResult(result);
    const hold = result.status === STATUS.DIRTY ? holdReport(cfg) : null;
    if (hold) console.log(`  ${holdLine(hold)} (${holdAge(hold)})`);
    process.exit(result.status === STATUS.PASSED || result.status === STATUS.LANDED ? 0 : 1);
  }
  const missingForMs = missingSince === null ? 0 : Date.now() - missingSince;
  const warning = warned ? null : noBrokerWarning(cfg, id, { missingForMs, graceMs });
  missingSince = observedLive(cfg) ? null : (missingSince ?? Date.now());
  if (warning) { console.error(warning); warned = true; }
  if (!process.env.BROKER_NO_AUTOSTART && missingForMs >= graceMs && listQueue(cfg).some((j) => j.id === id) && ensureBroker(cfg, root)) console.error(`wait: no daemon was running with ${id} queued; started one (log under ${join(cfg.targetDir, 'broker', 'logs')})`);
  announce(selfCheck(cfg, { skipNoDaemon: missingSince === null || Date.now() - missingSince < graceMs }).entries, said);
  if (!process.env.BROKER_NO_AUTOSTART) restartIfWedged(cfg, root, { spawner: (r, why) => spawnBroker(r, null, why, cfg.lane) });
  if (beatMs > 0 && Date.now() >= nextBeat) {
    const line = heartbeatLine(cfg, id);
    if (line) console.error(line);
    nextBeat = Date.now() + beatMs;
  }
  await sleep(pollMs);
}
const cfg = laneCfgFor(rootCfg, id);
const position = listQueue(cfg).findIndex((j) => j.id === id);
const where = heartbeatLine(cfg, id);
const alive = observedLive(cfg) && where;
console.error(`wait: timed out after ${timeoutMs / 1000}s waiting for ${id} (result expected at ${resultPath(cfg)})${position >= 0 ? ` (queue position ${position + 1})` : ''}${alive ? `; the daemon is alive and the job is ${where.replace(/^wait: \S+ /, '')}: run wait again, do not withdraw it` : ''}`);
process.exit(2);
