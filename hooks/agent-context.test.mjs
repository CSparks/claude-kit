// No context size limit; waste is the limit (KIT-D149, KIT-D158): an agent is flagged, warned about and replaced only for
// avoidable context (bash dumps, repeated lines, raw logs), never for its size. Covers the flag with the avoidable lines
// named, the resume that warns and never blocks, the dispatch refused until a wasteful agent's handoff is in the ticket
// Notes, the SubagentStop retire line, the removed ceiling config, and the no-wait rule in the patch-worker definition.
// Run: node hooks/agent-context.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, fixtureKit, hook, isoDaysAgo, reporter, tmpDir } from './test-harness.mjs';
import { handoffRequest, hasHandoff, overWaste, wasteFlag, WASTE_RETIRE_SHARE } from './lib/agent-context.mjs';
import { formatAgentLine } from './lib/agent-format.mjs';
import { readLadder } from '../scripts/dispatch-ladder.mjs';

const { ok, done } = reporter('agent-context');
const KIT = fixtureKit(isoDaysAgo(0));
const OLD = 'a1b2c3d4e5f6a7b8c';
const NEW = 'b2c3d4e5f6a7b8c9d';
const TICKET = 'KIT-T900';
const WALL = 1500;
const HUGE_TOKENS = 900000;

const handoff = (id) => `## Notes\n\n### Handoff ${id}\n- Jobs: j-1-a (passed)\n- State: patch landed\n- Next: run the suite\n- Files: hooks/x.mjs:10\n`;

let n = 0;
const user = (content) => ({ type: 'user', message: { role: 'user', content } });
const assistant = (content) => ({ type: 'assistant', message: { id: `m${n++}`, role: 'assistant', content, usage: { input_tokens: 1, output_tokens: 1 } } });
const call = (name, input) => { const id = `t${n++}`; return { id, block: { type: 'tool_use', id, name, input } }; };
const result = (id, text) => user([{ type: 'tool_result', tool_use_id: id, content: text }]);

// An agent that polled a broker job and read a Compiling wall: most of its context is avoidable.
function wastefulRows() {
  const rows = [user('Fix KIT-T900: brief text.')];
  const test = call('Bash', { command: 'cargo test -p game' });
  const wait = call('Bash', { command: 'node wait.mjs j-1 --root /repo' });
  rows.push(assistant([test.block]), result(test.id, `${Array.from({ length: WALL }, (_, i) => `   Compiling dep-${i} v1.${i}.0`).join('\n')}\nerror[E0308]: mismatched types\n`));
  rows.push(assistant([wait.block]), result(wait.id, Array.from({ length: 400 }, () => 'wait: j-1 queued at position 3 of 5').join('\n')));
  return rows;
}

// A big agent doing real work: ranged reads and long reasoning, no dumps.
function workingRows() {
  const rows = [user('Fix KIT-T901: brief text.')];
  for (let i = 0; i < 40; i++) {
    const read = call('Read', { file_path: `/repo/f${i}.rs`, offset: 10, limit: 40 });
    rows.push(assistant([{ type: 'text', text: `step ${i} `.repeat(600) }, read.block]), result(read.id, `line ${i}\n`.repeat(300)));
  }
  return rows;
}

try {
  const scratch = tmpDir('agent-context-');
  const write = (name, rows) => {
    const file = join(scratch, name);
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return file;
  };
  const wasteful = write('wasteful.jsonl', wastefulRows());
  const working = write('working.jsonl', workingRows());
  const row = (extra = {}) => ({ id: OLD, scope: 'implementer', model: 'claude-sonnet-5-5', status: 'done', task: 'work', tickets: [TICKET], ...extra });

  ok('the context ceiling is gone from the ladder config (KIT-D149)', !('contextCeilingTokens' in readLadder(KIT)));
  const flag = wasteFlag(row({ transcript: wasteful }));
  ok('an agent whose context is mostly avoidable is flagged with the share, the named lines and the handoff request', /WASTE \d+% of context/.test(flag) && flag.includes('Avoidable:') && flag.includes('cargo test') && flag.includes('[write-handoff]') && flag.includes(`Handoff ${OLD}`));
  ok('the flag reports no size limit', !/ceiling|> \d+k/.test(flag));
  ok('negative control: a huge agent doing real work has no flag', wasteFlag(row({ transcript: working, tokens: HUGE_TOKENS })) === '');
  ok('negative control: a huge row with no transcript has no flag', wasteFlag(row({ tokens: HUGE_TOKENS })) === '');
  ok('overWaste lists only the wasteful row', overWaste([row({ transcript: wasteful }), row({ id: NEW, transcript: working })]).map((r) => r.row.id).join() === OLD);
  ok(`the default threshold is conservative: more than ${WASTE_RETIRE_SHARE * 100}% avoidable`, WASTE_RETIRE_SHARE >= 0.5);
  ok('orient\'s agent line carries the flag', formatAgentLine(row({ transcript: wasteful })).includes('WASTE'));
  ok('negative: orient\'s agent line is clean for a working agent', !formatAgentLine(row({ transcript: working, tokens: HUGE_TOKENS })).includes('WASTE'));
  ok('the handoff request names the ticket and the four labels', /KIT-T900/.test(handoffRequest(row())) && /Jobs:, State:, Next:, Files:/.test(handoffRequest(row())));

  ok('a Handoff block for the agent with all four labels counts', hasHandoff(handoff(OLD), OLD));
  ok('negative: another agent\'s handoff does not count', !hasHandoff(handoff(NEW), OLD));
  ok('negative: a handoff missing a label does not count', !hasHandoff(handoff(OLD).replace('- Next: run the suite\n', ''), OLD));
  ok('negative: Notes with no Handoff block do not count', !hasHandoff('## Notes\n\nJobs: x\nState: y\nNext: z\nFiles: w\n', OLD));

  // resume-check: a warning, never a block
  const d = adopted(false);
  writeFileSync(join(d, '.ai', 'agents.jsonl'), [row({ transcript: wasteful }), row({ id: NEW, tokens: HUGE_TOKENS, transcript: working })].map((r) => JSON.stringify({ ts: new Date().toISOString(), ...r })).join('\n') + '\n');
  const send = (to, message) => hook('resume-check.mjs', { tool_name: 'SendMessage', tool_input: { to, message } }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  const warned = send(OLD, 'continue with the next ticket');
  ok('resuming a wasteful agent warns with the avoidable lines and does not block', warned.code === 0 && /WASTE/.test(warned.out) && warned.out.includes('Avoidable:'));
  ok('negative control: resuming a huge agent doing real work is silent', send(NEW, 'continue').code === 0 && !/WASTE/.test(send(NEW, 'continue').out));
  ok('negative: resuming an unknown agent passes', send('zzzz', 'continue').code === 0);

  // dispatch-guard: handoff before replacing a wasteful agent, and the warning
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  const ticketFile = join(d, '.ai', 'tickets', `${TICKET}-thing.md`);
  const dispatch = (prompt) => hook('dispatch-guard.mjs', { tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', model: 'sonnet', description: 'x', prompt: `${prompt} [job: fix] [model-override: fixture] [escalate: fixture]` } }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  writeFileSync(ticketFile, `---\nid: ${TICKET}\n---\n\n## Notes\n\nnothing yet\n`);
  const noHandoff = dispatch(`Continue ${TICKET}`);
  ok('a dispatch replacing a wasteful agent with no handoff is blocked and says how to ask', noHandoff.code === 2 && /handoff-before-replace/.test(noHandoff.out) && noHandoff.out.includes('[write-handoff]'));
  ok('[handoff-waived: reason] lets it through', dispatch(`Continue ${TICKET} [handoff-waived: agent crashed]`).code === 0);
  ok('negative: a dispatch citing another ticket is not blocked', dispatch('Work on KIT-T901').code === 0);
  writeFileSync(ticketFile, `---\nid: ${TICKET}\n---\n\n${handoff(NEW)}`);
  ok('a handoff written for a different agent does not release it', dispatch(`Continue ${TICKET}`).code === 2);
  writeFileSync(ticketFile, `---\nid: ${TICKET}\n---\n\n${handoff(OLD)}`);
  const released = dispatch(`Continue ${TICKET}`);
  ok('with the handoff in the ticket Notes the replacement dispatches', released.code === 0);
  ok('the dispatch warns about the wasteful agent', /mostly avoidable output/.test(released.out) && released.out.includes(OLD));
  const huge = write('huge-ticket.jsonl', workingRows());
  writeFileSync(join(d, '.ai', 'agents.jsonl'), [row({ id: 'f6a7b8c9d0e1f2a3b', tickets: ['KIT-T905'], tokens: HUGE_TOKENS, transcript: huge })].map((r) => JSON.stringify({ ts: new Date().toISOString(), ...r })).join('\n') + '\n');
  writeFileSync(join(d, '.ai', 'tickets', 'KIT-T905-thing.md'), '---\nid: KIT-T905\n---\n\n## Notes\n\nnothing yet\n');
  ok('negative control: replacing a huge agent doing real work needs no handoff', dispatch('Continue KIT-T905').code === 0);

  // read-only agents and agents working in another checkout own no ticket here (KIT-T715)
  const bare = (t) => writeFileSync(join(d, '.ai', 'tickets', `${t}-thing.md`), `---\nid: ${t}\n---\n\n## Notes\n\nnothing yet\n`);
  const extra = [row({ id: 'c3d4e5f6a7b8c9d0e', tickets: ['KIT-T902'], readOnly: 'analyst report only', transcript: wasteful }),
    row({ id: 'd4e5f6a7b8c9d0e1f', tickets: ['KIT-T903'], targetRoot: join(d, 'elsewhere'), transcript: wasteful }),
    row({ id: 'e5f6a7b8c9d0e1f2a', tickets: ['KIT-T904'], targetRoot: d, transcript: wasteful })];
  for (const t of ['KIT-T902', 'KIT-T903', 'KIT-T904']) bare(t);
  writeFileSync(join(d, '.ai', 'agents.jsonl'), extra.map((r) => JSON.stringify({ ts: new Date().toISOString(), ...r })).join('\n') + '\n');
  ok('negative: a read-only wasteful agent does not hold a ticket hostage', dispatch('Continue KIT-T902').code === 0);
  ok('negative: an agent working in another checkout owns no ticket of this store', dispatch('Continue KIT-T903').code === 0);
  ok('a wasteful writer working in this checkout with no handoff still blocks', dispatch('Continue KIT-T904').code === 2);

  // a read-only dispatch replaces no writer (KIT-T918)
  const as = (type, prompt) => hook('dispatch-guard.mjs', { tool_name: 'Agent', tool_input: { subagent_type: type, model: 'sonnet', description: 'x', prompt: `${prompt} [job: fix] [model-override: fixture] [escalate: fixture]` } }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  ok('a read-only agent type (Plan) citing a writer\'s ticket passes', as('Plan', 'Design from KIT-T904').code === 0);
  ok('a writer type tagged [read-only: reason] citing it passes', as('general-purpose', 'Read KIT-T904 [read-only: design only]').code === 0);
  ok('negative: the same writer dispatch untagged still blocks', as('general-purpose', 'Continue KIT-T904').code === 2);

  // only open tickets need the handoff (KIT-T818)
  const withStatus = (t, status, notes = 'nothing yet\n') => writeFileSync(join(d, '.ai', 'tickets', `${t}-thing.md`), `---\nid: ${t}\nstatus: ${status}\n---\n\n## Notes\n\n${notes}`);
  withStatus('KIT-T904', 'review');
  ok('a ticket the agent finished (review) needs no handoff', dispatch('Continue KIT-T904').code === 0);
  withStatus('KIT-T904', 'doing');
  ok('negative: an open ticket (doing) without a handoff still blocks', dispatch('Continue KIT-T904').code === 2);
  withStatus('KIT-T904', 'todo');
  ok('negative: an open ticket (todo) without a handoff still blocks', dispatch('Continue KIT-T904').code === 2);
  withStatus('KIT-T904', 'doing', 'Handoff (standing kit agent, retired for waste). Jobs: KIT-T904. State: claimed. Next: land it. Files: hooks/x.mjs.\n');
  ok('a Handoff block with the four labels counts without the agent id in its heading', dispatch('Continue KIT-T904').code === 0);
  withStatus('KIT-T904', 'doing', `Handoff ${NEW.slice(0, 8)}\n- Jobs: j\n- State: s\n- Next: n\n- Files: f\n`);
  ok('negative: a handoff headed with another agent\'s id does not count', dispatch('Continue KIT-T904').code === 2);

  // SubagentStop: retire line for waste only
  const stop = hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: OLD, agent_transcript_path: wasteful }, d, { CLAUDE_KIT_LADDER_ROOT: KIT });
  ok('SubagentStop tells the coordinator to retire an agent that ended mostly wasteful', /RETIRE/.test(stop.out) && stop.out.includes(OLD) && stop.out.includes('Avoidable:'));
  ok('negative control: SubagentStop is silent for a big agent that did real work', !/RETIRE/.test(hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: NEW, agent_transcript_path: working }, d, { CLAUDE_KIT_LADDER_ROOT: KIT }).out));

  // the no-wait rule lives in the patch-worker definition; no hook writes it into a brief
  const definition = readFileSync(join(import.meta.dirname, '..', 'agents', 'patch-worker.md'), 'utf8');
  ok('the patch-worker definition carries the no-wait rule (KIT-D115)', definition.includes('NO-WAIT RULE (KIT-D115)') && definition.includes('wait.mjs <id> --root <tree> --timeout 280') && definition.includes('wait AT MOST ONCE'));
  ok('the definition carries the handoff step the rule ends in', definition.includes('Past the one wait: write a Handoff block'));
  ok('the definition no longer names a context ceiling', !/context_ceiling_tokens|context ceiling/i.test(definition));
} finally {
  cleanup();
}

done();
