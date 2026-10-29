// The context ceiling and the handoff that retires an agent (KIT-D116): the flag on a past-ceiling agent, the
// blocked resume, the handoff request that passes, the dispatch refused until the handoff is in the ticket Notes,
// the SubagentStop retire line, and the no-wait rule appended to a patch-worker brief (KIT-D115).
// Run: node hooks/agent-context.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, fixtureKit, hook, isoDaysAgo, reporter } from './test-harness.mjs';
import { ceilingFlag, contextCeiling, handoffRequest, hasHandoff } from './lib/agent-context.mjs';
import { formatAgentLine } from './lib/agent-format.mjs';
import { NO_WAIT_MARK, isPatchWorker, withNoWaitRule } from './dispatch-nowait.mjs';

const { ok, done } = reporter('agent-context');
const KIT = fixtureKit(isoDaysAgo(0));
const OLD = 'a1b2c3d4e5f6a7b8c';
const NEW = 'b2c3d4e5f6a7b8c9d';
const TICKET = 'KIT-T900';

const handoff = (id) => `## Notes\n\n### Handoff ${id}\n- Jobs: j-1-a (passed)\n- State: patch landed\n- Next: run the suite\n- Files: hooks/x.mjs:10\n`;

try {
  ok('the ceiling is the kit config value, 200000 by default', contextCeiling() === 200000);
  const row = (tokens, extra = {}) => ({ id: OLD, scope: 'implementer', model: 'claude-sonnet-5-5', status: 'done', task: 'work', tokens, tickets: [TICKET], ...extra });
  ok('negative: an agent under the ceiling has no flag', ceilingFlag(row(150000)) === '');
  ok('negative: a row with no token count has no flag', ceilingFlag(row(undefined)) === '');
  const flag = ceilingFlag(row(450000));
  ok('a past-ceiling agent is flagged with its size, the ceiling and the handoff request', /450k > 200k/.test(flag) && flag.includes('[write-handoff]') && flag.includes(`Handoff ${OLD}`));
  ok('orient\'s agent line carries the flag', formatAgentLine(row(450000)).includes('retire, do not resume'));
  ok('negative: orient\'s agent line is clean under the ceiling', !formatAgentLine(row(150000)).includes('CONTEXT'));
  ok('the handoff request names the ticket and the four labels', /KIT-T900/.test(handoffRequest(row(1))) && /Jobs:, State:, Next:, Files:/.test(handoffRequest(row(1))));

  ok('a Handoff block for the agent with all four labels counts', hasHandoff(handoff(OLD), OLD));
  ok('negative: another agent\'s handoff does not count', !hasHandoff(handoff(NEW), OLD));
  ok('negative: a handoff missing a label does not count', !hasHandoff(handoff(OLD).replace('- Next: run the suite\n', ''), OLD));
  ok('negative: Notes with no Handoff block do not count', !hasHandoff('## Notes\n\nJobs: x\nState: y\nNext: z\nFiles: w\n', OLD));

  // resume-check
  const d = adopted(false);
  writeFileSync(join(d, '.ai', 'agents.jsonl'), [row(450000), row(150000, { id: NEW })].map((r) => JSON.stringify({ ts: new Date().toISOString(), ...r })).join('\n') + '\n');
  const send = (to, message) => hook('resume-check.mjs', { tool_name: 'SendMessage', tool_input: { to, message } }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  const blocked = send(OLD, 'continue with the next ticket');
  ok('resuming a past-ceiling agent is blocked and says to retire it', blocked.code === 2 && /past-ceiling/.test(blocked.out) && /KIT-D116/.test(blocked.out));
  ok('the handoff request is the one message that passes', send(OLD, handoffRequest(row(1))).code === 0);
  ok('[resume-over-ceiling: reason] overrides', send(OLD, 'continue [resume-over-ceiling: one line fix]').code === 0);
  ok('negative: resuming an agent under the ceiling passes', send(NEW, 'continue').code === 0);
  ok('negative: resuming an unknown agent passes', send('zzzz', 'continue').code === 0);

  // dispatch-guard: handoff before replace, and the warning
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  const ticketFile = join(d, '.ai', 'tickets', `${TICKET}-thing.md`);
  const dispatch = (prompt) => hook('dispatch-guard.mjs', { tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', model: 'sonnet', description: 'x', prompt: `${prompt} [job: fix] [model-override: fixture] [escalate: fixture]` } }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  writeFileSync(ticketFile, `---\nid: ${TICKET}\n---\n\n## Notes\n\nnothing yet\n`);
  const noHandoff = dispatch(`Continue ${TICKET}`);
  ok('a dispatch replacing a past-ceiling agent with no handoff is blocked and says how to ask', noHandoff.code === 2 && /handoff-before-replace/.test(noHandoff.out) && noHandoff.out.includes('[write-handoff]'));
  ok('[handoff-waived: reason] lets it through', dispatch(`Continue ${TICKET} [handoff-waived: agent crashed]`).code === 0);
  ok('negative: a dispatch citing another ticket is not blocked', dispatch('Work on KIT-T901').code === 0);
  writeFileSync(ticketFile, `---\nid: ${TICKET}\n---\n\n${handoff(NEW)}`);
  ok('a handoff written for a different agent does not release it', dispatch(`Continue ${TICKET}`).code === 2);
  writeFileSync(ticketFile, `---\nid: ${TICKET}\n---\n\n${handoff(OLD)}`);
  const released = dispatch(`Continue ${TICKET}`);
  ok('with the handoff in the ticket Notes the replacement dispatches', released.code === 0);
  ok('the dispatch warns about the past-ceiling agent', /agents past the context ceiling/.test(released.out) && released.out.includes(OLD));

  // SubagentStop: retire line
  const transcript = join(d, 'agent.jsonl');
  writeFileSync(transcript, JSON.stringify({ type: 'assistant', timestamp: new Date().toISOString(), message: { id: 'm1', model: 'claude-sonnet-5-5', usage: { input_tokens: 10, cache_read_input_tokens: 449990, output_tokens: 100 }, content: [] } }) + '\n');
  const stop = hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: OLD, agent_transcript_path: transcript }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  ok('SubagentStop tells the orchestrator to retire an agent that ended past the ceiling', /RETIRE/.test(stop.out) && stop.out.includes(OLD));
  const small = join(d, 'small.jsonl');
  writeFileSync(small, JSON.stringify({ type: 'assistant', timestamp: new Date().toISOString(), message: { id: 'm1', model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 5 }, content: [] } }) + '\n');
  ok('negative: SubagentStop is silent for an agent under the ceiling', !/RETIRE/.test(hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: NEW, agent_transcript_path: small }, d, { CLAUDE_KIT_LADDER_ROOT: KIT }).out));

  // the no-wait rule on a patch-worker brief
  ok('a patch-worker brief gets the no-wait rule once', withNoWaitRule({ subagent_type: 'claude-kit:patch-worker', prompt: 'fix it' })?.prompt.includes(NO_WAIT_MARK));
  ok('negative: a brief that already carries it is left alone', withNoWaitRule({ subagent_type: 'patch-worker', prompt: `x\n${NO_WAIT_MARK}` }) === null);
  ok('negative: another agent type gets no rule', withNoWaitRule({ subagent_type: 'implementer', prompt: 'x' }) === null && !isPatchWorker({ subagent_type: 'implementer' }));
  const tagged = hook('activity-tag.mjs', { tool_name: 'Agent', tool_input: { subagent_type: 'claude-kit:patch-worker', model: 'sonnet', description: 'patch DE-T1', prompt: 'do it' } }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  ok('activity-tag emits the rule in updatedInput for a patch-worker dispatch', tagged.code === 0 && tagged.out.includes(NO_WAIT_MARK));
  ok('negative: activity-tag adds no rule to another agent', !hook('activity-tag.mjs', { tool_name: 'Agent', tool_input: { subagent_type: 'implementer', model: 'sonnet', description: 'x', prompt: 'do it' } }, d, { CLAUDE_KIT_LADDER_ROOT: KIT }).out.includes(NO_WAIT_MARK));
} finally {
  cleanup();
}

done();
