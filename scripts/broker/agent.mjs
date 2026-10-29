// agent.mjs — which subagent is calling a broker script, and what a subagent may not do (KIT-D115).
// The broker-agent-tag hook adds `--agent <id>` to a subagent's submit/wait call; `CLAUDE_KIT_AGENT_ID`
// does the same from the environment. A subagent waits once, under 5 minutes, and otherwise hands back.
//
//   agentOf(flags, env)               -> the calling subagent's id, or null for the orchestrator
//   subagentRefusal(script, flags, env) -> a refusal text for a subagent-only violation, or null
//   MAX_SUBAGENT_WAIT_S               -> the longest wait a subagent may ask for

export const MAX_SUBAGENT_WAIT_S = 300;
const HANDOFF = 'write the handoff (job ids, state, next steps, file pointers in the ticket Notes) and end; the orchestrator resumes you from target/broker/finished.log (KIT-D115)';

export function agentOf(flags, env = process.env) {
  const given = typeof flags.agent === 'string' && flags.agent ? flags.agent : env.CLAUDE_KIT_AGENT_ID;
  return given || null;
}

export function subagentRefusal(script, flags, env = process.env) {
  if (flags.wait && script === 'submit') return `submit never waits: it prints the job id. ${agentOf(flags, env) ? `Wait once with wait.mjs <id> --timeout 280, or ${HANDOFF}.` : 'Use wait.mjs <id>.'}`;
  if (!agentOf(flags, env)) return null;
  if (script === 'watch') return `watch.mjs follows the whole checkout and is the orchestrator's: ${HANDOFF}.`;
  if (script === 'wait' && Number(flags.timeout) > MAX_SUBAGENT_WAIT_S) return `a subagent waits under ${MAX_SUBAGENT_WAIT_S / 60} minutes (KIT-D104): ${HANDOFF}.`;
  return null;
}
