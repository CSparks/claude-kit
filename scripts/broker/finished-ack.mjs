// finished-ack.mjs — which finished jobs the orchestrator has picked up (KIT-T822). A result is READY until its job id
// is acknowledged here: by a SendMessage reopening the submitting agent (resume-check hook), by a dispatch citing the
// ticket, or by `node ack.mjs <job…|--agent <id>>`.
//   <target>/broker/finished.ack   one line per ack: <ISO time> <job id> <by>
//
//   readAcks(brokerDir)              -> Set of acknowledged job ids
//   ackJobs(brokerDir, jobs, by)     -> appends one line per job not yet acknowledged; returns the ids added
//   ackAgent(brokerDir, agentId, by) -> ackJobs for every finished job that agent submitted
//   sameAgent(a, b)                  -> do two agent ids share their first 8 characters

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFinished } from './finished-log.mjs';

export const ACK_LOG = 'finished.ack';
const JOB_FIELD = 1;
const AGENT_PREFIX = 8;

export function readAcks(brokerDir) {
  try {
    return new Set(readFileSync(join(brokerDir, ACK_LOG), 'utf8').split('\n').filter(Boolean).map((l) => l.split(' ')[JOB_FIELD]));
  } catch { return new Set(); }
}

export const sameAgent = (a, b) => !!a && !!b && String(a).slice(0, AGENT_PREFIX) === String(b).slice(0, AGENT_PREFIX);

// Acknowledge every finished job the agent submitted (reopening it picks them up).
export function ackAgent(brokerDir, agentId, by) {
  return ackJobs(brokerDir, readFinished(brokerDir).filter((f) => sameAgent(f.agent, agentId)).map((f) => f.job), by || `reopened:${agentId}`);
}

export function ackJobs(brokerDir, jobs, by) {
  const have = readAcks(brokerDir);
  const added = [...new Set(jobs)].filter((j) => j && !have.has(j));
  if (!added.length) return [];
  mkdirSync(brokerDir, { recursive: true });
  const now = new Date().toISOString();
  appendFileSync(join(brokerDir, ACK_LOG), added.map((j) => `${now} ${j} ${by || 'orchestrator'}\n`).join(''));
  return added;
}
