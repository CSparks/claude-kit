// question-brief-gate (KIT-T846, KIT-D129, KIT-D152): the pre-call check keeps only the readiness of the topic: an
// exploring maintainer message and a question restating his words block; the summary above the questionnaire is
// judged after the call (question-brief-audit.test.mjs), so a thin or absent summary passes here and the call never waits.
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
const SETTLED = 'Good, go with the shorter limit. Ask me which one.';
const CALL_ID = 'toolu_01GATE';
const WAIT_CEILING_MS = 1500;

const dir = tmpDir('question-brief-');
const repoDir = adopted(false);
let n = 0;
const line = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const transcript = (user, ...replyLines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [line('user', user), ...replyLines].join('\n'));
  return file;
};
const prose = (value) => line('assistant', [{ type: 'text', text: value }]);
const ask = (file, questions = QUESTIONS) => hook('question-brief-gate.mjs', { tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions }, ...(file ? { transcript_path: file } : {}) }, repoDir);

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes('question-brief-gate'))));

  ok('a settled maintainer message passes', ask(transcript(SETTLED, prose('Checking the daemon log first.'))).code === 0);
  const started = Date.now();
  const unflushed = ask(transcript(SETTLED, prose('Short.')));
  ok('a thin summary no longer blocks before the call, and the call does not wait for its own reply to reach the transcript',
    unflushed.code === 0 && Date.now() - started < WAIT_CEILING_MS);
  ok('a call with no summary at all passes the pre-call gate', ask(transcript(SETTLED)).code === 0);

  const exploring = ask(transcript('should we maybe let the waiter replace the daemon sooner?', prose('Checking.')));
  ok('an exploring maintainer message is blocked as not ready', exploring.code === 2 && exploring.out.includes('- exploring:') && exploring.out.includes('question-ready'));
  ok('the block points at the questionnaire requirements and carries the exclusion surfaces', exploring.out.includes('q gates question') && exploring.out.includes('.claude-kit-ignore.yaml'));
  ok('control: a question that invites the questionnaire passes', ask(transcript('what is the limit? ask me which one to pick')).code === 0);

  const early = `Why does the daemon stall? ${'The tick scans every result file and parses the lockfile each time. '.repeat(6)}Decided: ship the tick fix and ask me only the limit.`;
  ok('control: a question early in a long settled message is not exploring', ask(transcript(early)).code === 0);

  // KIT-T929: a question the orchestrator already answered, and rhetorical anger, are not "exploring".
  const ANSWER = 'The analyst is reading the planner output and the gate tests right now; it has the three files open, found one stale citation, and will report the counts when the read finishes, so the build sign-off below does not wait on it.';
  const NEWEST = "Let's do it. What's the analyst doing right now?";
  ok('KIT-T929: a newest message that is a question answered in an earlier prose reply passes', ask(transcript(NEWEST, prose(ANSWER))).code === 0);
  ok('KIT-T929 control: the same question with no assistant reply still blocks', ask(transcript(NEWEST)).code === 2);
  ok('KIT-T929 control: the same question with only a one-word narration still blocks', ask(transcript(NEWEST, prose('Checking.'))).code === 2);
  ok('GG-D093: a short prior reply saying work waits on him lets the questionnaire through his question', ask(transcript(NEWEST, prose('Waiting on you.'))).code === 0);
  ok('GG-D093: "your call" and "which one is it" do the same', ask(transcript(NEWEST, prose('This is your call.'))).code === 0 && ask(transcript(NEWEST, prose('Which one is it?'))).code === 0);
  ok('GG-D093 control: a soft ask ("want me to") in a short reply still blocks', ask(transcript(NEWEST, prose('Want me to wire it?'))).code === 2);
  ok('GG-D093 control: a quoted hard phrase does not count', ask(transcript(NEWEST, prose('He wrote "waiting on you".'))).code === 2);
  const YELLED = 'TWO FUCKING LEADS. EVER HEAR TWO FUCKING LEAD GUITARS DO CALL AND RESPONSE OVER EVERYTHING ELSE?';
  ok('KIT-T929: a yelled rhetorical question passes', ask(transcript(YELLED)).code === 0);
  ok('KIT-T929: a profane question with no question word passes', ask(transcript('Two fucking leads on one bus, ever hear that work?')).code === 0);
  ok('KIT-T929 control: a profane message with a real question word still blocks', ask(transcript('What the fuck is the analyst doing right now?')).code === 2);
  ok('KIT-T929 control: a yelled message with an explicit floated idea still blocks', ask(transcript('SHOULD WE MAYBE SPLIT THE LEADS?')).code === 2);
  const tail = ask(transcript(`${'Context that is long and settled. '.repeat(12)}Which lane should carry the second lead?`));
  ok('KIT-T929: the block prints the end of the message that tripped the check', tail.code === 2 && tail.out.includes('Which lane should carry the second lead?'));

  const RESTATED = 'Keep the daemon restart limit at three minutes with the shared cache.';
  const restated = ask(transcript(RESTATED), [{ question: `${RESTATED.replace('.', '?')}`, header: 'Restart', options: OPTIONS }]);
  ok('a question restating his words is blocked', restated.code === 2 && restated.out.includes('- stated:'));
  ok('control: a new question on the same topic passes', ask(transcript(RESTATED)).code === 0);

  ok('no transcript fails open', ask(null).code === 0);
  ok('an unreadable transcript fails open', ask(join(dir, 'missing.jsonl')).code === 0);
  ok('garbage stdin fails open', hook('question-brief-gate.mjs', 'not json', repoDir).code === 0);
  ok('another tool is ignored', hook('question-brief-gate.mjs', { tool_name: 'Bash', tool_input: { questions: QUESTIONS }, transcript_path: transcript('should we maybe?') }, repoDir).code === 0);

  const exploringFile = transcript('should we maybe do it sooner?');
  writeFileSync(join(repoDir, '.claude-kit-ignore.yaml'), 'question-ready:\n  - "**"\n');
  ok('the ignore file lifts the readiness check', ask(exploringFile).code === 0);
} finally {
  cleanup();
}

done();
