#!/usr/bin/env node
// resubmit.mjs — queue a lost job again from its kept copy (KIT-T822). A job that left the queue with no result and no
// finished line (a crashed submit, a purged results dir) is recoverable while target/broker/submitted/<id>.json exists.
//   node resubmit.mjs <job id>     prints the new job id; the old id is acknowledged as superseded

import { join } from 'node:path';
import { loadCfg, parseFlags } from './cli.mjs';
import { laneOfRepo, withLane } from './config.mjs';
import { ackJobs } from './finished-ack.mjs';
import { resubmitJob, submittedJob } from './submissions.mjs';

const flags = parseFlags(process.argv.slice(2));
const id = flags._[0];
if (!id) { console.error('resubmit: name the lost job id'); process.exit(2); }
const { cfg } = loadCfg(flags);
const dir = join(cfg.targetDir, 'broker');
const kept = submittedJob(dir, id);
if (!kept) { console.error(`resubmit: no kept copy of ${id} under ${join(dir, 'submitted')}; brief a fresh worker from the ticket`); process.exit(1); }
const queued = resubmitJob(withLane(cfg, laneOfRepo(cfg, kept.repo)), id);
ackJobs(dir, [id], `resubmitted-as-${queued.id}`);
console.log(queued.id);
