// reask-gate (KIT-T448): an AskUserQuestion that restates a question file another session asked
// within 7 days, with no Resolution yet, is blocked; same session, no match, resolved, stale
// ask, [re-ask: reason] and an excluded path pass. A pass stamps (asked) on cited question ids.
// Run: node hooks/reask-gate.test.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, cleanup, hook, project, reporter } from './test-harness.mjs';
import { askedEntries, stampAsk } from '../scripts/question-asks.mjs';

const { ok, done } = reporter('reask-gate');
const TODAY = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 16).replace('T', ' ');

const QUESTION = (id, text, extra = '') => `---\nid: ${id}\nstatus: todo\nanswerable_by: user\n---\n\n**Q:** ${text}\n\n**Resolution:** <answer>\n${extra}`;
const GRABOIDS = 'Should graboids burrow under razed camps before the raid timer ends?';

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes('reask-gate'))));

  const d = project('required', 'FQR');
  const qdir = join(d, '.ai', 'questions');
  mkdirSync(qdir, { recursive: true });
  const file = join(qdir, 'FQR-Q001-graboids.md');
  writeFileSync(file, stampAsk(QUESTION('FQR-Q001', GRABOIDS), 'other-session', daysAgo(1)));
  const ask = (session, text, extra = {}) => hook('reask-gate.mjs', {
    tool_name: 'AskUserQuestion', session_id: session,
    tool_input: { questions: [{ question: text, header: extra.header || 'Graboids', options: [{ label: '(Recommended) Yes' }, { label: 'No' }] }] },
  }, d);

  const blocked = ask('mine', 'Do graboids burrow under razed camps before the raid timer?');
  ok('a restated question another session asked yesterday is blocked', blocked.code === 2);
  ok('the block names the file, the session and the date', /FQR-Q001/.test(blocked.out) && /other-session/.test(blocked.out) && blocked.out.includes(daysAgo(1).slice(0, 10)));
  ok('the block names the override token and the check id with both exclusion surfaces',
    blocked.out.includes('[re-ask: <reason>]') && blocked.out.includes('reask-gate') && blocked.out.includes('.claude-kit-ignore.yaml') && blocked.out.includes('claude-kit-ignore-'));
  ok('an id citation also blocks', ask('mine', 'Decide FQR-Q001', { header: 'x' }).code === 2);
  ok('the asking session itself passes', ask('other-session', 'Do graboids burrow under razed camps before the raid timer?').code === 0);
  ok('an unrelated question passes', ask('mine', 'Which colour for the stereo mixer faders on the settings page?').code === 0);
  ok('[re-ask: reason] passes', ask('mine', 'Do graboids burrow under razed camps before the raid timer? [re-ask: the answer changed]').code === 0);

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), `reask-gate:\n  - .ai/questions/**\n`);
  ok('a path excluded under reask-gate passes', ask('mine', 'Do graboids burrow under razed camps before the raid timer?').code === 0);
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), '');

  writeFileSync(file, stampAsk(QUESTION('FQR-Q001', GRABOIDS), 'other-session', daysAgo(9)));
  ok('an ask older than 7 days passes', ask('mine', 'Do graboids burrow under razed camps before the raid timer?').code === 0);

  writeFileSync(file, stampAsk(QUESTION('FQR-Q001', GRABOIDS).replace('<answer>', '(2026-10-12, chris) Yes'), 'other-session', daysAgo(1)));
  ok('a question with a Resolution passes', ask('mine', 'Do graboids burrow under razed camps before the raid timer?').code === 0);

  writeFileSync(file, QUESTION('FQR-Q001', GRABOIDS));
  ok('an unasked question passes', ask('mine', 'Do graboids burrow under razed camps before the raid timer?').code === 0);
  ok('a pass citing the id stamps (asked) for this session',
    ask('mine', 'Resolve FQR-Q001', { header: 'x' }).code === 0 && askedEntries(readFileSync(file, 'utf8')).some((e) => e.session === 'mine' && e.date === TODAY));

  ok('garbage stdin fails open', hook('reask-gate.mjs', 'not json', d).code === 0);
  ok('no questions dir fails open', hook('reask-gate.mjs', { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: GRABOIDS }] } }, project('required', 'FQN')).code === 0);
} finally {
  cleanup();
}
done();
