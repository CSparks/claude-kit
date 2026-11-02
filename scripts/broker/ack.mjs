#!/usr/bin/env node
// ack.mjs — mark finished jobs as picked up (KIT-T822), so orient and the successor gate stop listing "RESULT READY".
//   node ack.mjs <job id>…              acknowledge those jobs
//   node ack.mjs --agent <agent id>     acknowledge every finished job that agent submitted
//   node ack.mjs --all                  acknowledge every finished job

import { join } from 'node:path';
import { loadCfg, parseFlags } from './cli.mjs';
import { ackAgent, ackJobs } from './finished-ack.mjs';
import { readFinished } from './finished-log.mjs';

const flags = parseFlags(process.argv.slice(2));
const { cfg } = loadCfg(flags);
const dir = join(cfg.targetDir, 'broker');
const finished = readFinished(dir);
if (typeof flags.agent === 'string') {
  console.log(`acked ${ackAgent(dir, flags.agent).length} job(s) of agent ${flags.agent}`);
} else {
  const jobs = flags.all ? finished.map((f) => f.job) : flags._;
  if (!jobs.length) { console.error('ack: name a job id, --agent <id> or --all'); process.exit(2); }
  console.log(`acked ${ackJobs(dir, jobs, 'orchestrator').length} of ${jobs.length}`);
}
