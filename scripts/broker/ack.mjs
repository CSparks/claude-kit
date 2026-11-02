#!/usr/bin/env node
// ack.mjs — mark finished jobs as picked up (KIT-T822), so orient and the successor gate stop listing "RESULT READY".
//   node ack.mjs <job id>…              acknowledge those jobs
//   node ack.mjs --agent <agent id>     acknowledge every finished job that agent submitted
//   node ack.mjs --all                  acknowledge every finished job
//   node ack.mjs --handoff <agent id> --reason "<why>" [--ticket <id>…]
//                                       close that agent's handoff as "nothing owed" (KIT-T830): a comment on each ticket the
//                                       reconciler still names for it (or only the --ticket ones) ends the successor demand

import { join } from 'node:path';
import { asList, loadCfg, parseFlags } from './cli.mjs';
import { ackAgent, ackJobs } from './finished-ack.mjs';
import { readFinished } from './finished-log.mjs';
import { closeHandoffs } from './handoff-close.mjs';

const flags = parseFlags(process.argv.slice(2));
const { root, cfg } = loadCfg(flags);
const dir = join(cfg.targetDir, 'broker');
if (typeof flags.handoff === 'string') {
  try {
    const closed = closeHandoffs(root, flags.handoff, flags.reason, { tickets: asList(flags.ticket) });
    console.log(closed.length ? `closed handoff of agent ${flags.handoff}: no successor owed on ${closed.join(', ')}` : `agent ${flags.handoff} has no open handoff to close`);
  } catch (e) { console.error(`ack: ${e.message}`); process.exit(2); }
} else if (typeof flags.agent === 'string') {
  console.log(`acked ${ackAgent(dir, flags.agent).length} job(s) of agent ${flags.agent}`);
} else {
  const jobs = flags.all ? readFinished(dir).map((f) => f.job) : flags._;
  if (!jobs.length) { console.error('ack: name a job id, --agent <id>, --handoff <id> --reason "<why>" or --all'); process.exit(2); }
  console.log(`acked ${ackJobs(dir, jobs, 'orchestrator').length} of ${jobs.length}`);
}
