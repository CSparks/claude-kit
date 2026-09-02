#!/usr/bin/env node
// submit.mjs — a worker submits a job to the broker's queue and prints its id. The worker has
// already committed on its lane branch in its own worktree; this writes the job the broker will
// pick up. `wait.mjs <id>` then blocks on the result.
//
// USE:
//   node submit.mjs --root <build-checkout> --repo <name> --branch lane/<name> \
//     --command "cargo test -p foo --lib" [--command "…"] [--land] \
//     --ticket ST-T123 --title "…" [--worktree <abs path>]
//   node submit.mjs --root <dir> --json <job.json>     # submit a prepared job file
//
// --worktree lets the broker free the branch on a green land (it removes the worktree, then
// deletes the branch). Default: the current working directory (the worker's worktree).

import { readFileSync } from 'node:fs';
import { parseFlags, loadCfg, asList } from './cli.mjs';
import { writeJob, newJobId } from './result.mjs';

const flags = parseFlags(process.argv.slice(2));
const { cfg } = loadCfg(flags);

let job;
if (typeof flags.json === 'string') {
  job = JSON.parse(readFileSync(flags.json, 'utf8'));
} else {
  if (!flags.repo || !flags.branch) {
    console.error('submit: --repo and --branch are required (or pass --json <file>)');
    process.exit(2);
  }
  job = {
    id: newJobId(),
    repo: String(flags.repo),
    branch: String(flags.branch),
    commands: asList(flags.command).map(String),
    land: !!flags.land,
    ticket: flags.ticket ? String(flags.ticket) : null,
    title: flags.title ? String(flags.title) : '',
    worktree: typeof flags.worktree === 'string' ? flags.worktree : process.cwd(),
  };
}

const written = writeJob(cfg, job);
console.log(written.id);
