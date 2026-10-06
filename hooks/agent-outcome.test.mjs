// agent-outcome.test.mjs — KIT-D080: roster rows carry the job and the cost of a delegation
// (resolved model, duration, tokens, tool calls), and scripts/dispatch-outcomes.mjs summarises them
// per family and job. Run: node hooks/agent-outcome.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, hook, cleanup, reporter, tmpDir } from './test-harness.mjs';
import { declaredJob, outcomeFromResponse, outcomeFromTranscript } from './agent-outcome.mjs';
import { readAgents } from './lib.mjs';
import { summarizeOutcomes, familyOf } from '../scripts/dispatch-outcomes.mjs';

const { ok, done } = reporter('agent-outcome');

const assistant = (id, ts, usage, content = []) => JSON.stringify({
  type: 'assistant', timestamp: ts, uuid: `u-${id}-${ts}`, message: { id, model: 'claude-sonnet-5-5', usage, content },
});

try {
  ok('job token: read from the brief, lower-cased', declaredJob('do it [job: Targeted-Change] now') === 'targeted-change');
  ok('job token: absent -> empty', declaredJob('no token here') === '' && declaredJob(undefined) === '');

  const sync = { resolvedModel: 'claude-sonnet-5-5', totalDurationMs: 90920, totalTokens: 28099, totalToolUseCount: 18, content: 'x' };
  ok('response: a synchronous agent yields model, duration, tokens, tool calls',
    JSON.stringify(outcomeFromResponse(sync)) === JSON.stringify({ resolvedModel: 'claude-sonnet-5-5', durationMs: 90920, tokens: 28099, toolCalls: 18 }));
  ok('response: an async launch carries only the resolved model',
    JSON.stringify(outcomeFromResponse({ status: 'async_launched', agentId: 'a1', resolvedModel: 'claude-opus-5-5' })) === JSON.stringify({ resolvedModel: 'claude-opus-5-5' }));
  ok('response: garbage yields an empty outcome', Object.keys(outcomeFromResponse('nope')).length === 0 && Object.keys(outcomeFromResponse(null)).length === 0);

  const dir = tmpDir('kit-outcome-');
  const tp = join(dir, 'agent.jsonl');
  writeFileSync(tp, [
    assistant('m1', '2026-10-06T00:00:00.000Z', { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: 10 },
      [{ type: 'tool_use', id: 't1' }]),
    assistant('m1', '2026-10-06T00:00:01.000Z', { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: 10 },
      [{ type: 'tool_use', id: 't2' }]),
    assistant('m2', '2026-10-06T00:01:00.000Z', { input_tokens: 1, cache_creation_input_tokens: 5, cache_read_input_tokens: 200, output_tokens: 30 },
      [{ type: 'text', text: 'done' }]),
    'not json',
  ].join('\n'));
  const t = outcomeFromTranscript(tp);
  ok('transcript: model, duration across the first and last timestamp', t.resolvedModel === 'claude-sonnet-5-5' && t.durationMs === 60000);
  ok('transcript: tokens is the final request total, output sums turns once per message id', t.tokens === 236 && t.outputTokens === 40);
  ok('transcript: tool calls count distinct tool_use blocks', t.toolCalls === 2);
  ok('transcript: a missing file yields an empty outcome', Object.keys(outcomeFromTranscript(join(dir, 'gone.jsonl'))).length === 0);

  const repo = adopted(false);
  hook('agent-roster.mjs', {
    hook_event_name: 'PostToolUse', tool_name: 'Agent',
    tool_input: { description: '[Sonnet 5.5] Fix KIT-T1', subagent_type: 'general-purpose', model: 'sonnet', prompt: 'brief [job: fix]' },
    tool_response: { agentId: 'sync1', ...sync },
  }, repo);
  hook('agent-roster.mjs', {
    hook_event_name: 'PostToolUse', tool_name: 'Agent',
    tool_input: { description: 'Edit KIT-T2', subagent_type: 'general-purpose', model: 'sonnet', prompt: 'brief [job: targeted-change]' },
    tool_response: { agentId: 'bg1', status: 'async_launched', resolvedModel: 'claude-sonnet-5-5' },
  }, repo);
  hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: 'bg1', agent_type: 'general-purpose', agent_transcript_path: tp }, repo);

  const rows = readAgents(repo);
  const sync1 = rows.find((r) => r.id === 'sync1');
  const bg1 = rows.find((r) => r.id === 'bg1');
  ok('roster: a synchronous dispatch row records job, resolved model, duration, tokens, tool calls',
    sync1 && sync1.job === 'fix' && sync1.resolvedModel === 'claude-sonnet-5-5' && sync1.durationMs === 90920 && sync1.tokens === 28099 && sync1.toolCalls === 18);
  ok('roster: a background agent gains its cost from the SubagentStop transcript',
    bg1 && bg1.status === 'done' && bg1.job === 'targeted-change' && bg1.durationMs === 60000 && bg1.toolCalls === 2 && bg1.tokens === 236);
  ok('roster: a stop with no transcript path adds no outcome fields and does not throw',
    (() => {
      hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: 'sync1' }, repo);
      const r = readAgents(repo).find((x) => x.id === 'sync1');
      return r && r.status === 'done' && r.tokens === 28099;
    })());

  ok('family: ids, aliases and the local lane', familyOf('claude-opus-5-5') === 'opus' && familyOf('sonnet') === 'sonnet' && familyOf('local-qwen') === 'local-qwen' && familyOf('') === 'unknown');
  const summary = summarizeOutcomes([
    { id: 'a', status: 'done', resolvedModel: 'claude-sonnet-5-5', job: 'fix', durationMs: 10000, tokens: 100, toolCalls: 4 },
    { id: 'b', status: 'done', resolvedModel: 'claude-sonnet-5-5', job: 'fix', durationMs: 30000, tokens: 300, toolCalls: 8 },
    { id: 'c', status: 'in-flight', model: 'opus', scope: 'general-purpose' },
    { id: 'd', status: 'done', model: 'local-qwen', job: 'targeted-change', durationMs: 5000 },
  ]);
  const fix = summary.find((s) => s.family === 'sonnet' && s.job === 'fix');
  ok('summary: groups by family and job with averages', fix && fix.runs === 2 && fix.done === 2 && fix.avgDurationS === 20 && fix.avgTokens === 200 && fix.avgToolCalls === 6);
  ok('summary: a row with no job falls back to its agent type; absent cost stays null',
    summary.some((s) => s.family === 'opus' && s.job === 'general-purpose' && s.avgTokens === null && s.done === 0));
  ok('summary: the local lane is its own family', summary.some((s) => s.family === 'local-qwen' && s.job === 'targeted-change' && s.avgDurationS === 5));
} finally {
  cleanup();
}
done();
