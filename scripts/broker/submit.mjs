#!/usr/bin/env node
// submit.mjs — a worker queues a patch for the broker and prints its id. The envelope (see
// envelope.mjs) comes on stdin; nothing is written in the tree. A dry run against current HEAD
// misses in seconds: the stale result prints as JSON and the exit code is 1. `wait.mjs <id>`
// blocks on the outcome. When no live broker holds the lock, submit starts one detached
// (BROKER_NO_AUTOSTART=1 opts out). `--land` (needs `--ticket`) commits and pushes a green patch.
// `--revises <id>` also withdraws <id> when it is still queued (its result reads `superseded by <new id>`).
// `--no-patch` queues a test-only job: no envelope, the `--test` commands run on HEAD (check-only,
// never with `--land`), e.g. to see whether a failure is already on main.
// `--repo <submodule> --no-pin --land` pushes the submodule commit and leaves the superproject alone.
// `--pin <submodule>=<sha>` (superproject job, repeatable) builds and tests with the submodule at <sha>;
// with `--land` the gitlink and the patch paths land in ONE commit, and <sha> must already be on the
// submodule's remote.
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
import { STATUS, writeJob, writeResult } from './result.mjs';
import { withdrawJob } from './withdraw.mjs';
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
const queuedJob = writeJob(cfg, out.job);
console.log(queuedJob.id);
if (typeof flags.revises === 'string') {
  const gone = withdrawJob(cfg, flags.revises, { status: STATUS.SUPERSEDED, message: `superseded by ${queuedJob.id}` });
  console.error(gone.ok ? `submit: withdrew queued ${flags.revises} (superseded by ${queuedJob.id})` : `submit: ${flags.revises} not withdrawn: ${gone.error}`);
}
if (!process.env.BROKER_NO_AUTOSTART && ensureBroker(cfg, root)) console.error(`submit: no broker was running; started one (idle exit ${IDLE_EXIT_MIN} min)`);
else announce(selfCheck(cfg, { skipNoDaemon: true }).entries, new Set());
