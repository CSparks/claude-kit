// question-brief-gate (KIT-T846, KIT-D129): an AskUserQuestion needs a brief that meets the content standard and a topic
// that is ready to ask. A full brief after a settled message passes; each missing part, an exploring maintainer
// message, a question restating his words, and the ignore file are each exercised, with controls.
// Run: node hooks/question-brief-gate.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('question-brief-gate');
const OPTIONS = [
  { label: '(Recommended) Three minutes', description: 'replace a silent daemon after three minutes' },
  { label: 'Ten minutes', description: 'keep the current limit' },
];
const QUESTIONS = [{ question: 'How long may the daemon stay silent before it is replaced?', header: 'Kill limit', multiSelect: false, options: OPTIONS }];

const FULL_BRIEF = [
  'Decision: how long the broker may stay silent before a waiter replaces it, needed now because a land job sat queued for six minutes behind a hung daemon.',
  'Evidence: scripts/broker/stall.mjs holds the limit at ten minutes (RESTART_MS), and the dirt-empire log target/broker/logs/daemon-35624.log shows no beat from 01:26 to 01:32; KIT-T845 has the timeline.',
  'Option Three minutes replaces the daemon at once and costs a restart if a long step never beats, which the landing phases already protect. Option Ten minutes keeps today\'s limit and leaves a queued job waiting that long.',
  'I recommend three minutes because a wedged daemon was the only thing holding the queue and the restart restores the tree from the journal.',
  'Not being asked: the tick fix itself, which is already settled and shipped.',
].join('\n\n');

const dir = tmpDir('question-brief-');
let n = 0;
const line = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const transcript = (user, prose) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [line('user', user), line('assistant', [{ type: 'text', text: prose }])].join('\n'));
  return file;
};
const repoDir = adopted(false);
const ask = (file, questions = QUESTIONS) => hook('question-brief-gate.mjs', { tool_name: 'AskUserQuestion', tool_input: { questions }, ...(file ? { transcript_path: file } : {}) }, repoDir);
const SETTLED = 'Good, go with the shorter limit. Ask me which one.';

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes('question-brief-gate'))));

  ok('a full brief after a settled message passes', ask(transcript(SETTLED, FULL_BRIEF)).code === 0);

  const thin = ask(transcript(SETTLED, '- the daemon stalled\n- pick a limit'));
  ok('two bullets are blocked', thin.code === 2);
  ok('the block names every part the brief lacks and both exclusion surfaces',
    ['length', 'decision', 'evidence', 'options', 'recommendation', 'not asked'].every((p) => thin.out.includes(`- ${p}:`)) && thin.out.includes('question-brief') && thin.out.includes('.claude-kit-ignore.yaml'));

  const without = (pattern) => FULL_BRIEF.split('\n\n').filter((p) => !pattern.test(p)).join('\n\n');
  const padded = (text) => `${text}\n\n${'The broker daemon beats every second while a command runs and the waiters poll it. '.repeat(10)}`;
  const missing = (pattern, part) => { const r = ask(transcript(SETTLED, padded(without(pattern)))); return r.code === 2 && r.out.includes(`- ${part}:`); };
  ok('no evidence sources is blocked', missing(/^Evidence/, 'evidence'));
  ok('no recommendation reason is blocked', missing(/^I recommend/, 'recommendation'));
  ok('nothing said about what is not asked is blocked', missing(/^Not being asked/, 'not asked'));
  ok('options absent from the brief are blocked', missing(/^Option Three/, 'options'));
  ok('no decision statement is blocked', missing(/^Decision/, 'decision'));

  const mid = ask(transcript('should we maybe let the waiter replace the daemon sooner?', FULL_BRIEF));
  ok('an exploring maintainer message is blocked as not ready', mid.code === 2 && mid.out.includes('- exploring:') && mid.out.includes('question-ready'));
  ok('control: a question that invites the questionnaire passes', ask(transcript('what is the limit? ask me which one to pick', FULL_BRIEF)).code === 0);

  const early = `Why does the daemon stall? ${'The tick scans every result file and parses the lockfile each time. '.repeat(6)}Decided: ship the tick fix and ask me only the limit.`;
  ok('control: a question early in a long settled message is not exploring', ask(transcript(early, FULL_BRIEF)).code === 0);

  const stated = ask(transcript('Keep the daemon restart limit at three minutes with the shared cache.', FULL_BRIEF), [{ question: 'Keep the daemon restart limit at three minutes with the shared cache?', header: 'Restart', options: OPTIONS }]);
  ok('a question restating his words is blocked', stated.code === 2 && stated.out.includes('- stated:'));
  ok('control: a new question on the same topic passes', ask(transcript('Keep the daemon restart limit at three minutes with the shared cache.', FULL_BRIEF)).code === 0);

  ok('no transcript fails open', ask(null).code === 0);
  ok('an unreadable transcript fails open', ask(join(dir, 'missing.jsonl')).code === 0);
  ok('garbage stdin fails open', hook('question-brief-gate.mjs', 'not json', repoDir).code === 0);
  ok('another tool is ignored', hook('question-brief-gate.mjs', { tool_name: 'Bash', tool_input: { questions: QUESTIONS }, transcript_path: transcript(SETTLED, 'x') }, repoDir).code === 0);

  const thinFile = transcript(SETTLED, 'short');
  writeFileSync(join(repoDir, '.claude-kit-ignore.yaml'), 'question-brief:\n  - "**"\n');
  ok('the ignore file lifts the brief check', ask(thinFile).code === 0);
  writeFileSync(join(repoDir, '.claude-kit-ignore.yaml'), 'question-ready:\n  - "**"\n');
  ok('lifting the ready check alone leaves the brief check on', ask(thinFile).code === 2);
  ok('the ready check lifted passes an exploring message with a full brief', ask(transcript('should we maybe do it sooner?', FULL_BRIEF)).code === 0);
} finally {
  cleanup();
}

done();
