#!/usr/bin/env node
// watch.mjs — block until the broker finishes something, across every job and lane, then print it
// (KIT-T697). wait.mjs follows ONE job id; this follows the checkout: use it where an orchestrator
// would otherwise tail the daemon log. Never tail or grep target/broker/logs (broker-log-gate blocks it).
//
// USE: node watch.mjs --root <checkout> [--for landing|suite|any] [--timeout <s>] [--since <ISO>] [--poll <ms>]
//   --for landing  the next job to LAND          --for suite  the next finished full-suite run
//   --for any      (default) the next finished job or suite run, whatever its status
// Prints each matching event (job id / suite sha, status). exit 0 = the event is good (landed, passed,
// green); 1 = a bad one (failed, stale, gate, conflict, red suite); 2 = timed out (default 100 s, under the
// 120 s a foreground Bash call survives; wait again). --since replays what finished after that time, so
// back-to-back calls miss nothing: the last line printed is `watch: next --since <ISO>`.

import { parseFlags, loadCfg } from './cli.mjs';
import { eventsSince, matches } from './watch-events.mjs';
import { subagentRefusal } from './agent.mjs';

const DEFAULT_TIMEOUT_S = 100;
const FOR = ['landing', 'suite', 'any'];
const flags = parseFlags(process.argv.slice(2));
const refusal = subagentRefusal('watch', flags);
if (refusal) { console.error(`watch: ${refusal}`); process.exit(2); }
const want = flags.for === undefined ? 'any' : String(flags.for);
if (!FOR.includes(want)) {
  console.error(`watch: --for takes one of ${FOR.join(', ')}`);
  process.exit(2);
}
const since = flags.since === undefined ? Date.now() : Date.parse(String(flags.since));
if (!Number.isFinite(since)) {
  console.error('watch: --since needs an ISO time');
  process.exit(2);
}
const { cfg } = loadCfg(flags);
const timeoutMs = (Number(flags.timeout) || DEFAULT_TIMEOUT_S) * 1000;
const pollMs = Number(flags.poll) || cfg.pollMs;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deadline = Date.now() + timeoutMs;
do {
  const hits = eventsSince(cfg, since).filter((e) => matches(e, want));
  if (hits.length) {
    for (const e of hits) console.log(e.text);
    console.log(`watch: next --since ${new Date(hits[hits.length - 1].at).toISOString()}`);
    process.exit(hits.every((e) => e.ok) ? 0 : 1);
  }
  await sleep(pollMs);
} while (Date.now() < deadline);
console.error(`watch: nothing finished (${want}) in ${timeoutMs / 1000}s since ${new Date(since).toISOString()}; run watch again`);
process.exit(2);
