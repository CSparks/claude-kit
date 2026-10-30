#!/usr/bin/env node
// submit.mjs — a worker queues a patch for the broker and prints its id. The envelope (see
// envelope.mjs) comes on stdin; nothing is written in the tree. A dry run against current HEAD
// misses in seconds: the stale result prints as JSON and the exit code is 1. `wait.mjs <id>`
// blocks on the outcome. When no live broker holds the lock, submit starts one detached
// (BROKER_NO_AUTOSTART=1 opts out). `--land` (needs `--ticket`) commits and pushes a green patch.
// `--revises <id>` also withdraws <id> when it is still queued (its result reads `superseded by <new id>`).
// `--no-patch` queues a test-only job: no envelope, the `--test` commands run on HEAD (check-only,
// never with `--land`), e.g. to see whether a failure is already on main.
// Before a job joins the queue, precheck.mjs runs a fast `cargo check` of the patch in the broker's precheck tree; a compile error
// prints the failed result (exit 1) and the job never takes a queue slot; so does a syntax error in a touched .mjs/.cjs/.js script
// (`node --check`). The pre-write gate runs at submit too (submit-lib.mjs).
// The dry run also refuses at submit (exit 1, no job id) a create-exists, a SEARCH not found, an ambiguous SEARCH, and a
// byte-identical envelope that already came back stale on the same base (stale-envelope.mjs); stderr names each op index,
// path, reason and fix.
// `--measure` queues a measurement job: it runs in the idle lane (measure.mjs) and never delays a landing.
// `--agent <id>` names the submitting subagent (the broker-agent-tag hook adds it); the result and the finished-job line carry it.
// `--repo <submodule> --no-pin --land` pushes the submodule commit and leaves the superproject alone.
// `--pin <submodule>=<sha>` (superproject job, repeatable) builds and tests with the submodule at <sha>;
// with `--land` the gitlink and the patch paths land in ONE commit, and <sha> must already be on the
// submodule's remote. `--pin` with `--no-patch --land` (or an empty envelope) is a pin-only job: it
// lands the gitlink alone.
// A binary file (a glb, a png) rides the envelope as `*** write-binary <path>` plus base64 lines, or
// `--binary <repo path>=<file>` (repeatable) reads the file and adds the section; it creates or
// replaces the file whole.
//
// USE:
//   node submit.mjs --root <tree> --ticket ST-T123 --title "…" --test "cargo t -p x" \
//     [--repo <name>] [--land] [--revises <id>] [--session <id>] <<'PATCH'   (session: default the harness session id; sessions are served in turn)
//   *** edit path/file.rs
//   <<<<<<< SEARCH … ======= … >>>>>>> REPLACE
//   PATCH

import { readFileSync } from 'node:fs';
import { asList, parseFlags, loadCfg } from './cli.mjs';
import { binaryEnvelope } from './binary-flag.mjs';
import { laneOfRepo, repoByName, withLane } from './config.mjs';
import { ensureQueuedLanes, IDLE_EXIT_MIN } from './ensure.mjs';
import { announce, selfCheck } from './health.mjs';
import { STATUS, writeJob, writeResult } from './result.mjs';
import { withdrawJob } from './withdraw.mjs';
import { buildPatchJob, refusalLines } from './submit-lib.mjs';
import { submitUsageProblem } from './submit-usage.mjs';
import { cargoScopeRefusal } from './cargo-scope.mjs';
import { subagentRefusal } from './agent.mjs';
import { precheckJob } from './precheck.mjs';

const flags = parseFlags(process.argv.slice(2));
const usage = submitUsageProblem(process.argv.slice(2), flags, { isTTY: !!process.stdin.isTTY });
if (usage) { (usage.code ? console.error : console.log)(usage.text); process.exit(usage.code); }
const refusal = subagentRefusal('submit', flags);
if (refusal) { console.error(`submit: ${refusal}`); process.exit(2); }
const { root, cfg } = loadCfg(flags);
const notCargo = cargoScopeRefusal(root);
if (notCargo) { console.error(`submit: ${notCargo}`); process.exit(2); }

if (flags.land && typeof flags.ticket !== 'string') {
  console.error('submit: --land needs --ticket (the commit message cites it)');
  process.exit(2);
}
const binary = binaryEnvelope(asList(flags.binary), { cwd: process.cwd() });
if (binary.error) {
  console.error(`submit: ${binary.error}`);
  process.exit(2);
}
const piped = flags['no-patch'] || (flags.binary && process.stdin.isTTY) ? '' : readFileSync(0, 'utf8');
const out = buildPatchJob(cfg, flags, `${piped}\n${binary.text}`);
if (out.error) {
  console.error(`submit: ${out.error}`);
  process.exit(2);
}
if (out.result) {
  for (const line of refusalLines(out.result)) console.error(line);
  console.log(JSON.stringify(writeResult(cfg, out.result), null, 2));
  process.exit(1);
}
// The job joins its repo's own queue (KIT-D096): a submodule's jobs never sit in the root lane.
const laneCfg = withLane(cfg, laneOfRepo(cfg, out.job.repo));
const rejected = precheckJob(laneCfg, out.job, repoByName(laneCfg, out.job.repo));
if (rejected) {
  console.log(JSON.stringify(writeResult(laneCfg, rejected), null, 2));
  process.exit(1);
}
const queuedJob = writeJob(laneCfg, out.job);
console.log(queuedJob.id);
if (typeof flags.revises === 'string') {
  const gone = withdrawJob(laneCfg, flags.revises, { status: STATUS.SUPERSEDED, message: `superseded by ${queuedJob.id}` });
  console.error(gone.ok ? `submit: withdrew queued ${flags.revises} (superseded by ${queuedJob.id})` : `submit: ${flags.revises} not withdrawn: ${gone.error}`);
}
const started = process.env.BROKER_NO_AUTOSTART ? [] : ensureQueuedLanes(cfg, root);
if (started.length) console.error(`submit: no broker was running for lane ${started.join(', ')}; started one (idle exit ${IDLE_EXIT_MIN} min)`);
else announce(selfCheck(laneCfg, { skipNoDaemon: true }).entries, new Set());
