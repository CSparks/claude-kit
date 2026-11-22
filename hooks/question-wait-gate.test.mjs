// question-wait-gate (KIT-T1480): a (Recommended) option that offers to accept a wait over 60 seconds blocks unless the question
// carries [wait-checked: ...]; a short wait, milliseconds, a reduce-the-wait option and a non-recommended option pass; the dry
// run judges the summary. Run: node hooks/question-wait-gate.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { LONG_SUMMARY, gate, option, question, storeWithDecisions } from './question-gates-fixture.mjs';
import { questionGateWired } from './question-gate-wiring.mjs';
import { runGates } from '../scripts/q-gates.mjs';
import { GATES, gateDigest, gateText } from './lib/gate-protocol.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';
import { optionWaitOffers, waitOffers } from './lib/wait-offer.mjs';
import { summaryWaitOffers } from './lib/question-wait-audit.mjs';

const { ok, done } = reporter('question-wait-gate');
const GATE = 'question-wait-gate.mjs';
const BLOCK = 2;
const PASS = 0;
const TAG = '[wait-checked: the maintainer set no time budget for a cold launch, so none applies]';
const accept = (duration, extra = {}) => ({ ...question('How should the cold launch be handled?', 'Launch', [
  option('(Recommended) Accept the wait', `a cold launch takes ${duration}`),
  option('Cut the load', 'caches the world build'),
]), ...extra });

try {
  ok('wired into hooks.json for AskUserQuestion (through question-gates)', questionGateWired('question-wait-gate'));

  const root = storeWithDecisions();
  const run = (q, extra = {}) => gate(GATE, root, [q], extra);

  const blocked = run(accept('about 3 minutes'));
  ok('a recommended option accepting a 3 minute wait is blocked', blocked.code === BLOCK, blocked.out);
  ok('the block names the duration, the option, the check id, the tag form and both exclusion surfaces',
    blocked.out.includes('3 minutes') && blocked.out.includes('180 s') && blocked.out.includes('Accept the wait') && blocked.out.includes('question-wait')
    && blocked.out.includes(TOKENS.waitChecked.form) && blocked.out.includes('.claude-kit-ignore.yaml'));
  ok('the same option with [wait-checked: ...] passes', run(accept('about 3 minutes', { question: `How should the cold launch be handled? ${TAG}` })).code === PASS);
  ok('the tag in an option description passes', run(accept('about 3 minutes', { options: [option('(Recommended) Accept the wait', `a cold launch takes about 3 minutes ${TAG}`), option('Cut the load', 'caches')] })).code === PASS);
  ok('an empty tag clears nothing', run(accept('about 3 minutes', { question: 'How should it be handled? [wait-checked: ]' })).code === BLOCK);
  ok('a 20 s wait passes', run(accept('about 20 s')).code === PASS);
  ok('a wait of exactly a minute passes', run(accept('a minute')).code === PASS && run(accept('60 seconds')).code === PASS && run(accept('half a minute')).code === PASS);

  const notRecommended = question('How should the cold launch be handled?', 'Launch', [
    option('(Recommended) Cache the world build', 'the cold launch drops to 20 s'),
    option('Accept the wait', 'a cold launch takes about 3 minutes'),
  ]);
  ok('a non-recommended option that mentions minutes passes', run(notRecommended).code === PASS);

  for (const duration of ['a minute and a half', '180 s', 'three minutes', 'about 3-minute', '1m30s', '2 hours', 'a couple of minutes', 'two and a half minutes']) {
    ok(`blocked: ${duration}`, run(accept(duration)).code === BLOCK);
  }
  ok('milliseconds never count', run(accept('180 ms')).code === PASS && run(accept('33.7 ms a frame')).code === PASS);
  const reduce = question('How should the cold launch be handled?', 'Launch', [option('(Recommended) Cut the launch from 3 minutes to 20 s', 'keeps the world build in the cache'), option('Leave it', 'nothing changes')]);
  ok('an option that cuts the wait passes', run(reduce).code === PASS);
  ok('a recommended option without a cue to accept passes', run(question('Which?', 'Launch', [option('(Recommended) Measure the launch', 'it takes 3 minutes today'), option('Skip', 'nothing')])).code === PASS);

  const request = { tool_name: 'request_user_input' };
  const suffixed = question('Handle the launch?', 'Launch', [option('Accept the wait (Recommended)', 'takes about 3 minutes'), option('Cut the load', 'cache')]);
  ok('request_user_input marks the recommendation as a suffix and is judged the same', gate(GATE, root, [suffixed], request).code === BLOCK);

  writeFileSync(join(root, '.claude-kit-ignore.yaml'), 'question-wait:\n  - "**"\n');
  ok('the ignore file lifts the gate', run(accept('about 3 minutes')).code === PASS);
  writeFileSync(join(root, '.claude-kit-ignore.yaml'), '');

  ok('garbage stdin fails open', hook(GATE, 'not json', root).code === PASS);
  ok('another tool is ignored', hook(GATE, { tool_name: 'Bash', tool_input: { questions: [accept('about 3 minutes')] } }, root).code === PASS);

  ok('waitOffers reads a summary sentence', waitOffers('We can live with a cold launch of about 3 minutes.').length === 1 && waitOffers('The launch takes 3 minutes.').length === 0);
  ok('optionWaitOffers pairs the label cue with the description duration', optionWaitOffers({ label: 'Accept the wait', description: 'takes 4 min' })[0]?.seconds === 240);
  ok('summaryWaitOffers: the tag in the questions clears the summary', summaryWaitOffers({ prose: 'Keep the 3 minute launch.' }, { input: { questions: [accept('x', { question: TAG })] } }).length === 0
    && summaryWaitOffers({ prose: 'Keep the 3 minute launch.' }, { input: { questions: [accept('x')] } }).length === 1);

  const protocol = gateText('question');
  ok('q gates question lists the check and the tag form', protocol.includes('question-wait') && protocol.includes(TOKENS.waitChecked.form) && GATES.question.checks.some((c) => c.tokens.includes(TOKENS.waitChecked)));
  ok('the compaction digest names the tag', gateDigest().join('\n').includes('[wait-checked:'));

  const draftDir = tmpDir('qwait-draft-');
  const dry = async (value) => {
    const file = join(draftDir, `draft-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, JSON.stringify(value));
    let out = '';
    const code = await runGates(['question', '--draft', file], { root, out: { write: (s) => { out += s; } }, err: { write: () => {} } });
    return { code, out };
  };
  const calm = question('Which lever goes first?', 'Lever');
  const accepting = `${LONG_SUMMARY} We can accept the wait of about 3 minutes for a cold launch.`;
  const refused = await dry({ summary: accepting, questions: [calm] });
  ok('the dry run refuses a summary that accepts a 3 minute wait', refused.code === BLOCK && /question-wait \(summary above the call\)/.test(refused.out), refused.out);
  ok('the dry run passes it with the tag in the question', (await dry({ summary: accepting, questions: [{ ...calm, question: `${calm.question} ${TAG}` }] })).code === PASS);
  ok('control: the dry run passes the long summary with no wait', (await dry({ summary: LONG_SUMMARY, questions: [calm] })).code === PASS);
  ok('the dry run lists the option block through the gate', (await dry({ questions: [accept('about 3 minutes')] })).out.includes('== question-wait-gate =='));
} finally {
  cleanup();
}
done();
