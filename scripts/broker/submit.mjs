#!/usr/bin/env node
// submit.mjs — a worker queues a patch for the broker and prints its id. The envelope (see
// envelope.mjs) comes on stdin; nothing is written in the tree. A dry run against current HEAD
// misses in seconds: the stale result prints as JSON and the exit code is 1. `wait.mjs <id>`
// blocks on the outcome. When no live broker holds the lock, submit starts one detached
// (BROKER_NO_AUTOSTART=1 opts out). `--land` (needs `--ticket`) commits and pushes a green patch.
// `--no-patch` queues a test-only job: no envelope, the `--test` commands run on HEAD (check-only,
// never with `--land`), e.g. to see whether a failure is already on main.
//
// USE:
//   node submit.mjs --root <tree> --ticket ST-T123 --title "…" --test "cargo t -p x" \
//     [--repo <name>] [--land] [--revises <id>] <<'PATCH'
//   *** edit path/file.rs
//   <<<<<<< SEARCH … ======= … >>>>>>> REPLACE
//   PATCH

import { readFileSync } from 'node:fs';
import { parseFlags, loadCfg } from './cli.mjs';
import { ensureBroker, IDLE_EXIT_MIN } from './ensure.mjs';
import { announce, selfCheck } from './health.mjs';
import { writeJob, writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';

const flags = parseFlags(process.argv.slice(2));
const { root, cfg } = loadCfg(flags);

if (flags.land && typeof flags.ticket !== 'string') {
  console.error('submit: --land needs --ticket (the commit message cites it)');
  process.exit(2);
}
const out = buildPatchJob(cfg, flags, flags['no-patch'] ? '' : readFileSync(0, 'utf8'));
if (out.error) {
  console.error(`submit: ${out.error}`);
  process.exit(2);
}
if (out.result) {
  console.log(JSON.stringify(writeResult(cfg, out.result), null, 2));
  process.exit(1);
}
console.log(writeJob(cfg, out.job).id);
if (!process.env.BROKER_NO_AUTOSTART && ensureBroker(cfg, root)) console.error(`submit: no broker was running; started one (idle exit ${IDLE_EXIT_MIN} min)`);
else announce(selfCheck(cfg).entries, new Set());
