#!/usr/bin/env node
// submit.mjs — a worker queues a patch for the broker and prints its id. The envelope (see
// envelope.mjs) comes on stdin; nothing is written in the tree. A dry run against current HEAD
// misses in seconds: the stale result prints as JSON and the exit code is 1. `wait.mjs <id>`
// blocks on the outcome.
//
// USE:
//   node submit.mjs --root <tree> --ticket ST-T123 --title "…" --test "cargo t -p x" \
//     [--repo <name>] [--land] [--revises <id>] <<'PATCH'
//   *** edit path/file.rs
//   <<<<<<< SEARCH … ======= … >>>>>>> REPLACE
//   PATCH
//   node submit.mjs --root <dir> --json <job.json>     # submit a prepared job file (lane jobs)
//   node submit.mjs --root <dir> --repo <r> --branch lane/x …   # legacy lane job

import { readFileSync } from 'node:fs';
import { parseFlags, loadCfg, asList } from './cli.mjs';
import { writeJob, writeResult, newJobId } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';

const flags = parseFlags(process.argv.slice(2));
const { cfg } = loadCfg(flags);

if (typeof flags.json === 'string' || flags.branch) {
  const job = typeof flags.json === 'string' ? JSON.parse(readFileSync(flags.json, 'utf8')) : {
    id: newJobId(), repo: String(flags.repo || ''), branch: String(flags.branch), commands: asList(flags.test || flags.command).map(String),
    land: !!flags.land, ticket: flags.ticket ? String(flags.ticket) : null, title: flags.title ? String(flags.title) : '',
    worktree: typeof flags.worktree === 'string' ? flags.worktree : process.cwd(),
  };
  console.log(writeJob(cfg, job).id);
} else {
  if (flags.land) { console.error('submit: --land arrives with the path-only land landing'); process.exit(2); }
  const out = buildPatchJob(cfg, flags, readFileSync(0, 'utf8'));
  if (out.error) { console.error(`submit: ${out.error}`); process.exit(2); }
  if (out.result) {
    console.log(JSON.stringify(writeResult(cfg, out.result), null, 2));
    process.exit(1);
  }
  console.log(writeJob(cfg, out.job).id);
}
