// Tests for the outcome ledger and dispatch report (KIT-T419).
// Run: node scripts/dispatch-report.test.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from '../hooks/test-harness.mjs';
import { jobStats, proposals, dispatchLine, MIN_LANDINGS } from './dispatch-report.mjs';
import { outcomeRow, stopOutcome, readOutcomes, appendOutcome } from '../hooks/lib/dispatch-ledger.mjs';

const { ok, done } = reporter('dispatch-report');
const row = (job, model, outcome = 'completed', tokens = 1000, ts = '2026-10-11T00:00:00Z') => ({ ts, id: `${job}${model}`, job, model, tokens, tool_uses: 5, duration_ms: 1000, outcome });
const many = (n, ...a) => Array.from({ length: n }, () => row(...a));
const jobs = { ui: { family: 'opus', evidence: '2026-10-10' }, fix: { family: 'sonnet', evidence: '2026-10-10' }, deep: { family: 'fable', explicit_only: true } };

try {
  const stats = jobStats([...many(3, 'ui', 'sonnet', 'completed', 900), row('ui', 'sonnet', 'failed', 100), ...many(2, 'ui', 'opus', 'completed', 3000)]);
  ok('stats: landings, failures, tokens per landing by model', stats.ui.sonnet.landings === 3 && stats.ui.sonnet.failures === 1 && stats.ui.sonnet.tokensPerLanding === 933 && stats.ui.opus.tokensPerLanding === 3000);

  const down = proposals(many(MIN_LANDINGS, 'ui', 'sonnet'), jobs);
  ok('sonnet landed 3 clean on an opus row -> downgrade proposal', down.length === 1 && down[0].kind === 'downgrade' && down[0].to === 'sonnet' && /propose downgrade/.test(down[0].text));
  ok('2 landings are not enough', proposals(many(2, 'ui', 'sonnet'), jobs).length === 0);
  ok('a failure blocks the downgrade', proposals([...many(3, 'ui', 'sonnet'), row('ui', 'sonnet', 'failed')], jobs).length === 0);
  ok('outcomes older than the row evidence are consumed', proposals(many(3, 'ui', 'sonnet', 'completed', 1, '2026-10-09T00:00:00Z'), jobs).length === 0);
  const flag = proposals(many(2, 'fix', 'opus'), jobs);
  ok('opus used twice on a sonnet row -> flag', flag.length === 1 && flag[0].kind === 'flag' && flag[0].count === 2);
  ok('an explicit-only row is never proposed against', proposals(many(5, 'deep', 'opus'), jobs).length === 0);
  ok('rows without a job are ignored', Object.keys(jobStats([row('', 'opus')])).length === 0);

  ok('stop outcome: error payload -> failed', stopOutcome({ error: 'boom' }) === 'failed' && stopOutcome({ status: 'failed' }) === 'failed');
  ok('stop outcome: plain stop -> completed', stopOutcome({ hook_event_name: 'SubagentStop' }) === 'completed');
  const r = outcomeRow({ id: 'a1', rosterRow: { job: 'fix', model: 'sonnet' }, outcome: { tokens: 42, toolCalls: 3, durationMs: 9, resolvedModel: 'claude-sonnet-5-5' } });
  ok('outcome row: the ledger fields', r.id === 'a1' && r.job === 'fix' && r.model === 'sonnet' && r.tokens === 42 && r.tool_uses === 3 && r.duration_ms === 9 && r.outcome === 'completed');

  const dir = adopted(false);
  appendOutcome(dir, r);
  const file = join(dir, '.ai', 'dispatch-outcomes.jsonl');
  writeFileSync(file, `${readFileSync(file, 'utf8')}not json\n`);
  ok('ledger read skips a corrupt line', readOutcomes(dir).length === 1);

  const repo = adopted(false);
  hook('agent-roster.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Task', tool_input: { description: 'x', subagent_type: 'general-purpose', model: 'sonnet', prompt: '[job: fix]' }, tool_response: { agent_id: 'ag9' } }, repo);
  hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: 'ag9', agent_type: 'general-purpose' }, repo);
  const led = readOutcomes(repo);
  ok('SubagentStop appends {job, model, outcome} to the ledger', led.length === 1 && led[0].job === 'fix' && led[0].model === 'sonnet' && led[0].outcome === 'completed' && led[0].id === 'ag9');

  const live = adopted(false);
  mkdirSync(join(live, '.ai'), { recursive: true });
  ok('no ledger -> no orient line', dispatchLine([live]) === null);
  const day = new Date(Date.now() + 86400000).toISOString();
  writeFileSync(join(live, '.ai', 'dispatch-outcomes.jsonl'), `${many(3, 'build', 'sonnet', 'completed', 1000, day).map((x) => JSON.stringify(x)).join('\n')}\n`);
  ok('orient line: one !! dispatch: line naming the proposal', /^!! dispatch: 1 open proposal\(s\) — build: opus->sonnet/.test(dispatchLine([live]) || ''));
} finally {
  cleanup();
}
done();
