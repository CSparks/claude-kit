// Tests for the per-job weekly reassessment (KIT-T419, KIT-D088).
// Run: node scripts/job-capability.test.mjs

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jobCapabilityTable, redateRows } from './job-capability.mjs';
import { readLadder } from './dispatch-ladder.mjs';
import { refresh } from './model-refresh.mjs';
import { autoReviewDirective } from '../hooks/lib/auto-review.mjs';
import { hook, cleanup, reporter, fixtureKit, isoDaysAgo, quietHome, homeEnv } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('job-capability');
const fetchStub = async (url) => ({ ok: true, text: async () => (/pricing/.test(url) ? '' : '<code>claude-opus-5-5</code> <code>claude-sonnet-5-5</code>') });

try {
  const kit = fixtureKit('2026-09-01');
  const jobs = readLadder(kit).jobs;
  ok('the live table carries the wiring and ui-creative rows and no bare ui row', !!jobs.wiring && jobs['ui-creative'].family === 'opus' && jobs.wiring.family === 'sonnet' && !jobs.ui);
  ok('targeted-change is haiku with a sonnet fallback and a 100k context bound', jobs['targeted-change'].family === 'haiku' && jobs['targeted-change'].fallback === 'sonnet' && jobs['targeted-change'].context_tokens === '100000');
  ok('the refresh period is weekly', readLadder(kit).refreshDays === 7);

  const day = new Date(Date.now() + 86400000).toISOString();
  const outcomes = Array.from({ length: 3 }, () => ({ ts: day, id: 'x', job: 'build', model: 'sonnet', tokens: 2000, outcome: 'completed' }));
  const table = jobCapabilityTable({ jobs, costs: { sonnet: { inputPerMTok: 2, outputPerMTok: 10 } }, outcomes });
  ok('the table has one row per job', table.split('\n').length === 2 + Object.keys(jobs).length);
  ok('the ledger and its proposal appear on the job row', /\| build \| opus .*sonnet 3 @ 2000 .*propose downgrade/.test(table));
  ok('a job with no outcomes says so and keeps', /\| wiring \| sonnet .*\| \$2 \/ \$10 \| no outcomes \| keep \|/.test(table));

  const touched = redateRows(kit, '2026-10-10', ['wiring', 'chore']);
  const after = readLadder(kit).jobs;
  ok('redate sets the named rows only', touched.length === 2 && after.wiring.evidence === '2026-10-10' && after.chore.evidence === '2026-10-10' && after.fix.evidence === '2026-09-01');
  ok('redate all touches every row', redateRows(kit, '2026-10-11', ['all']).length === Object.keys(after).length);

  const r = await refresh({ kitRoot: kit, now: new Date(), fetchImpl: fetchStub, env: {} });
  ok('the research note carries the per-job capability section', /## Capability per job/.test(readFileSync(r.research, 'utf8')) && /\| wiring \|/.test(readFileSync(r.research, 'utf8')));

  const text = autoReviewDirective({ title: 'WEEKLY X', age: 9, job: 'research', brief: 'do it.', receipt: 'done' });
  ok('the directive orders a dispatch, names the job and the exception rule', /DISPATCH NOW/.test(text) && /\[job: research\]/.test(text) && /ONLY an exception/.test(text) && /9d since/.test(text));
  ok('a never-run review reads never run', /never run/.test(autoReviewDirective({ title: 'T', age: Infinity, job: 'wiring', brief: 'b', receipt: 'r' })));

  const stale = fixtureKit(isoDaysAgo(9));
  mkdirSync(join(stale, '.ai'), { recursive: true });
  writeFileSync(join(stale, '.ai', 'model-lineup.json'), JSON.stringify({ refreshed: isoDaysAgo(9), models: ['claude-opus-5-5'] }));
  const out = hook('housekeeping.mjs', { hook_event_name: 'SessionStart' }, stale, { CLAUDE_KIT_LADDER_ROOT: stale, ...homeEnv(quietHome()) });
  ok('housekeeping prints the weekly reassessment as a dispatch directive', /WEEKLY MODEL REASSESSMENT DUE \(9d/.test(out.out) && /DISPATCH NOW/.test(out.out) && !/MODEL REFRESH DUE/.test(out.out));
  ok('the live research notes exist', existsSync(new URL('../research/models-2026-10-10.md', import.meta.url)));
} finally {
  cleanup();
}
done();
