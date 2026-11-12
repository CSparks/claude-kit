#!/usr/bin/env node
// wait.mjs — block on a job's result with a bounded poll, print it, and exit with the job's
// status so a worker's turn is never left stopped on a background task. exit 0 = passed or landed;
// 1 = failed/stale/gate/conflict/dirty; 2 = timed out, killed or crashed while the job is still queued or running: wait again, never a failing code (KIT-T851). A result older than the job's current
// inflight run is a previous attempt's and is not final. The last stdout line is `wait: <id> <state> (exit N)` (KIT-T840).
//
// A heartbeat line (heartbeat.mjs: queue position, or running time and command) goes to stderr
// every --heartbeat seconds (default 60; 0 = off).
//
// USE: node wait.mjs <id> --root <build-checkout> [--timeout <s>] [--tool-timeout <s>] [--poll <ms>] [--grace-ms <ms>] [--heartbeat <s>]
// exit 3 = the id is unknown (not queued, running or resulted). A --root naming a submodule maps to its lane (root-map.mjs).
// (--tool-timeout: the Bash call's own timeout; wait ends itself 10 s before it, default 120 s, so --timeout is cut to fit)
// (--grace-ms: how long no broker may be seen before wait says so; default 10000, a restart's gap)

import { parseFlags, loadCfg } from './cli.mjs';
import { laneCfgFor } from './lanes.mjs';
import { join } from 'node:path';
import { isCurrentResult } from './current.mjs';
import { brokerPaths } from './config.mjs';
import { listMeasure, listQueue, readResult, STATUS } from './result.mjs';
import { inflightHas, readInflight } from './preimage.mjs';
import { printResult } from './report.mjs';
import { IDLE_EXIT_MIN, NO_BROKER_GRACE_MS, ensureBroker, noBrokerWarning, spawnBroker } from './ensure.mjs';
import { observedLive } from './lock.mjs';
import { announce, selfCheck } from './health.mjs';
import { heartbeatLine } from './heartbeat.mjs';
import { restartIfWedged } from './stall.mjs';
import { holdAge, holdLine, holdReport } from './hand-hold.mjs';
import { agentOf, subagentRefusal } from './agent.mjs';
import { heartbeatKey, repeatPrinter } from './collapse-repeats.mjs';
import { armWaitGuard } from './wait-guard.mjs';
import { HARNESS_FOREGROUND_S, waitWindow } from './wait-limits.mjs';

const DEFAULT_HEARTBEAT_S = 60;
const EXIT = { OK: 0, NOT_OK: 1, RUNNING: 2, UNKNOWN: 3 };
const flags = parseFlags(process.argv.slice(2));
const id = flags._[0];

// The last stdout line names the state and the exit code, so a caller that pipes wait through tail, or reads a task
// notification that reports the wrapper's exit 0, still sees "STILL RUNNING" and not "done".
function finish(state, code) {
  console.log(`wait: ${id} ${state} (exit ${code})`);
  process.exit(code);
}
if (!id) {
  console.error('wait: a job id is required');
  process.exit(2);
}
const refusal = subagentRefusal('wait', flags);
if (refusal) { console.error(`wait: ${refusal}`); process.exit(2); }
const { root, cfg: rootCfg } = loadCfg(flags);
const subagent = Boolean(agentOf(flags));
const window = waitWindow(flags, { subagent });
const timeoutMs = window.seconds * 1000;
const CUT_ADVICE = {
  true: `the harness moves any foreground call to the background at ${HARNESS_FOREGROUND_S} s, so a job that outlasts it is handed off, not waited on again`,
  false: 'pass --tool-timeout <s> with a matching Bash timeout for longer',
};
if (window.clamped) console.error(`wait: --timeout ${window.asked} cut to ${window.seconds} s to end inside the Bash call's window; ${CUT_ADVICE[subagent]}`);
const pollMs = Number(flags.poll) || rootCfg.pollMs;
const graceMs = flags['grace-ms'] === undefined ? NO_BROKER_GRACE_MS : Number(flags['grace-ms']);
const beatMs = (flags.heartbeat === undefined ? DEFAULT_HEARTBEAT_S : Number(flags.heartbeat)) * 1000;

// A heartbeat that only moved its clock is the same line: "queued at position 3" prints once, then "(repeated N×)".
const beats = repeatPrinter((line) => console.error(line), { key: heartbeatKey });

const sleep =(ms) => new Promise((r) => setTimeout(r, ms));

const resultPath = (c) => join(brokerPaths(c).results, `${id}.json`);
const known = (c) => listQueue(c).some((j) => j.id === id) || listMeasure(c).some((j) => j.id === id) || readResult(c, id) || inflightHas(readInflight(c), id);
if (!known(laneCfgFor(rootCfg, id))) {
  console.error(`wait: unknown job ${id}: not queued, running or resulted under ${brokerPaths(laneCfgFor(rootCfg, id)).home} (root ${root}); check the id and --root`);
  finish('UNKNOWN JOB', EXIT.UNKNOWN);
}

const disarm = armWaitGuard(() => finish('STILL RUNNING', EXIT.RUNNING));
const deadline = Date.now() + timeoutMs;
let warned = false;
let missingSince = null;
const said = new Set();
let nextBeat = Date.now() + beatMs;
while (Date.now() < deadline) {
  const cfg = laneCfgFor(rootCfg, id);
  const result = readResult(cfg, id);
  if (result && isCurrentResult(cfg, result)) {
    disarm();
    beats.flush();
    printResult(result);
    const hold = result.status === STATUS.DIRTY ? holdReport(cfg) : null;
    if (hold) console.log(`  ${holdLine(hold)} (${holdAge(hold)})`);
    finish(result.status, result.status === STATUS.PASSED || result.status === STATUS.LANDED ? EXIT.OK : EXIT.NOT_OK);
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
    if (line) beats.line(line);
    nextBeat = Date.now() + beatMs;
  }
  await sleep(pollMs);
}
beats.flush();
const cfg = laneCfgFor(rootCfg, id);
const position = listQueue(cfg).findIndex((j) => j.id === id);
const where = heartbeatLine(cfg, id);
const alive = observedLive(cfg) && where;
console.error(`wait: timed out after ${timeoutMs / 1000}s waiting for ${id} (result expected at ${resultPath(cfg)})${position >= 0 ? ` (queue position ${position + 1})` : ''}${alive ? `; the daemon is alive and the job is ${where.replace(/^wait: \S+ /, '')}: run wait again, do not withdraw it` : ''}`);
finish('STILL RUNNING', EXIT.RUNNING);
