// coordination-model.test.mjs — planning is separate from coordination (KIT-D098): the capability
// table routes coordination to sonnet and plans to opus with fable as the fallback, orient flags a
// main thread on another family and names the /model switch, and the base CLAUDE.md states the rule.
// Run: node scripts/coordination-model.test.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { familyOf, mainThreadNotice } from './coordination-model.mjs';
import { readLadder, resolveJob, KIT_ROOT } from './dispatch-ladder.mjs';
import { adopted, cleanup, hook, reporter } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('coordination-model');

try {
  const ladder = readLadder();
  ok('the table has a coordination row on sonnet', ladder.jobs.coordination && ladder.jobs.coordination.family === 'sonnet');
  const plan = resolveJob({ job: 'plan' });
  ok('the plan job runs on opus with fable as its fallback and is self-escalating', plan.family === 'opus' && plan.fallback === 'fable' && ladder.jobs.plan.self_escalating === true);
  ok('the plan row carries today\'s evidence date and the decision', /^2026-10-1[7-9]|^2026-1[1-2]|^2027/.test(ladder.jobs.plan.evidence) && /KIT-D098/.test(ladder.jobs.plan.source));
  ok('no row other than deep and the plan fallback puts fable on a job', Object.entries(ladder.jobs).every(([id, j]) => j.family !== 'fable' || id === 'deep'));

  ok('familyOf reads ids and aliases', familyOf('claude-opus-5-5') === 'opus' && familyOf('sonnet') === 'sonnet' && familyOf('claude-fable-5-1') === 'fable' && familyOf('gpt') === null);
  const fable = mainThreadNotice('claude-fable-5-1');
  ok('a fable main thread is flagged with the exact switch', /main thread runs fable/.test(fable) && fable.includes('`/model sonnet`') && /plan job \(opus, fallback fable\)/.test(fable), fable);
  ok('an opus main thread is flagged', /main thread runs opus/.test(mainThreadNotice('claude-opus-5-5')));
  ok('control: a sonnet main thread, an unknown model and no model are silent', mainThreadNotice('claude-sonnet-5-5') === null && mainThreadNotice('mystery-1') === null && mainThreadNotice(undefined) === null);

  const repo = adopted(false);
  const flagged = hook('orient.mjs', { model: 'claude-opus-5-5' }, repo);
  ok('orient prints the notice for an opus main thread', /main thread runs opus/.test(flagged.out) && flagged.out.includes('/model sonnet'), flagged.out.slice(-300));
  ok('orient is silent for a sonnet main thread', !/main thread runs/.test(hook('orient.mjs', { model: 'claude-sonnet-5-5' }, repo).out));
  ok('orient is silent when the harness reports no model', !/main thread runs/.test(hook('orient.mjs', {}, repo).out));

  const base = readFileSync(join(KIT_ROOT, 'user-config', 'CLAUDE.global.md'), 'utf8');
  ok('the base CLAUDE.md states the rule and no longer names opus and fable orchestrators', /Planning is separate from\s+coordination/.test(base) && /KIT-D098/.test(base) && !/Opus and fable are the\s+orchestrator models/.test(base));
} finally { cleanup(); }
done();
