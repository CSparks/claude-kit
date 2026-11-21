// question-brief-audit and a questionnaire a PreToolUse hook denied (KIT-T1060): a denied call never reached the
// maintainer, so the Stop backstop does not judge it; it does separate, so the resend needs the whole summary (at least 40
// words) in the message directly above it (KIT-T1465). The questionnaire's own question text never adds to the prose
// count (KIT-T1448).
// Run: node hooks/question-brief-blocked.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, reporter, tmpDir } from './test-harness.mjs';
import { auditAsk, auditStop } from './question-audit-harness.mjs';
import { REAL_FIXED_BRIEF, SHORT_QUESTIONS, THIN_BRIEF } from './question-brief-real-fixtures.mjs';

const { ok, done } = reporter('question-brief-blocked');
const dir = tmpDir('question-brief-blocked-');
const repoDir = adopted(false);
const SESSION = 'session-bbbb2222';
const SETTLED = 'Resume any remaining work.';
const BLOCKED_ID = 'toolu_BLOCKED';
const REASK_ID = 'toolu_REASK';
const SUMMARY_WORDS = 30;
const NARRATION_SUMMARY = Array.from({ length: SUMMARY_WORDS }, (_, i) => `word${i}`).join(' ');
const ONE_LINE = 'Block triage: process failure. I am filing it and re-asking with the citations.';
const LONG_QUESTION = `${Array.from({ length: 30 }, (_, i) => `detail${i}`).join(' ')}?`;
const LONG_QUESTIONS = [{ ...SHORT_QUESTIONS[0], question: LONG_QUESTION }];

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const signature = Buffer.concat([Buffer.from([8, 4, 18, 32]), Buffer.from('B\tnarration'), Buffer.from('payload')]).toString('base64');
const narration = (value) => ({ type: 'thinking', thinking: value, signature });
const text = (value) => ({ type: 'text', text: value });
const askBlock = (id, questions = SHORT_QUESTIONS) => ({ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions } });
const bash = (id) => ({ type: 'tool_use', id, name: 'Bash', input: { command: 'q show KIT-T1' } });
const reply = (...blocks) => blocks.map((b) => entry('assistant', [b]));
const emptyAssistant = () => ({ type: 'thinking', thinking: '', signature: 'sig' });
const hookBlocked = (id) => entry('user', [{ type: 'tool_result', tool_use_id: id, is_error: true, content: 'PreToolUse:AskUserQuestion hook error: [node question-grounded-gate.mjs]: BLOCKED: an option matches an open ticket the questionnaire does not cite.' }]);
const dismissed = (id) => entry('user', [{ type: 'tool_result', tool_use_id: id, is_error: true, content: "The user doesn't want to proceed with this tool use." }]);
const answered = (id) => entry('user', [{ type: 'tool_result', tool_use_id: id, content: 'answered' }]);
const ran = (id) => entry('user', [{ type: 'tool_result', tool_use_id: id, content: 'ok' }]);
const transcript = (...lines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', SETTLED), ...lines.flat()].join('\n'));
  return file;
};
const stop = (file) => auditStop({ session_id: SESSION, transcript_path: file }, repoDir);
const reask = (file, questions = SHORT_QUESTIONS) => auditAsk({ session_id: SESSION, tool_name: 'AskUserQuestion', tool_use_id: REASK_ID, tool_input: { questions }, transcript_path: file }, repoDir);
const silent = (r) => r.code === 0 && r.out.trim() === '';

try {
  const realShape = transcript(
    reply(narration(NARRATION_SUMMARY), askBlock(BLOCKED_ID)), hookBlocked(BLOCKED_ID),
    reply(text(ONE_LINE), bash('toolu_b1')), ran('toolu_b1'),
    reply(text(REAL_FIXED_BRIEF), askBlock(REASK_ID)), answered(REASK_ID),
  );
  ok('Stop: a hook-denied call is not judged, so the real shape (short narration summary, denied call, one line, answered re-ask) is silent', silent(stop(realShape)));

  const longThenBlocked = transcript(
    reply(text(REAL_FIXED_BRIEF), askBlock(BLOCKED_ID)), hookBlocked(BLOCKED_ID),
    reply(text(ONE_LINE), askBlock(REASK_ID)), answered(REASK_ID),
  );
  ok('a long reply, a denied call, then a one-line note above the resend blocks the stop (KIT-T1465)', stop(longThenBlocked).code === 2);
  const onePoint = reask(longThenBlocked);
  ok('the resend judged on PostToolUse counts only the one line above it, not the long reply before the denied call', onePoint.out.includes('the summary above it is missing or too short') && /Counted \d+ words in 1 block/.test(onePoint.out) && onePoint.out.includes('resend after a block'));

  const resentWhole = transcript(
    reply(text(REAL_FIXED_BRIEF), askBlock(BLOCKED_ID)), hookBlocked(BLOCKED_ID),
    reply(text(`${ONE_LINE}\n\n${REAL_FIXED_BRIEF}`), askBlock(REASK_ID)), answered(REASK_ID),
  );
  ok('control: a resend that repeats the whole summary directly above it is silent on Stop and on PostToolUse', silent(stop(resentWhole)) && silent(reask(resentWhole)));

  const words = (count) => Array.from({ length: count }, (_, i) => `w${i}`).join(' ');
  const resendOf = (summary) => transcript(reply(text(REAL_FIXED_BRIEF), askBlock(BLOCKED_ID)), hookBlocked(BLOCKED_ID), reply(text(summary), askBlock(REASK_ID)), answered(REASK_ID));
  ok('boundary: a resend with 39 words above it is thin, with 40 words it passes', reask(resendOf(words(39))).code === 2 && silent(reask(resendOf(words(40)))));

  const thinThenBlocked = transcript(
    reply(text(THIN_BRIEF), askBlock(BLOCKED_ID)), hookBlocked(BLOCKED_ID),
    reply(text('Re-asking.'), askBlock(REASK_ID)), answered(REASK_ID),
  );
  const thin = stop(thinThenBlocked);
  ok('control: a thin re-ask after a denied call still blocks the stop, and the denied call is not named', thin.code === 2 && thin.out.split('Questionnaire "').length === 2);

  const unblocked = transcript(reply(text(THIN_BRIEF), askBlock(REASK_ID)), answered(REASK_ID));
  ok('control: an answered thin call still blocks the stop', stop(unblocked).code === 2);

  const dismissedThin = transcript(reply(text(THIN_BRIEF), askBlock(REASK_ID)), dismissed(REASK_ID));
  ok('control: a call the maintainer dismissed (not a hook denial) is still judged', stop(dismissedThin).code === 2);

  const summed = transcript(reply(narration(NARRATION_SUMMARY), askBlock(REASK_ID, LONG_QUESTIONS)), answered(REASK_ID));
  ok('the 30-word prose plus the 30-word question text stays thin (KIT-T1448): the question text is never added to the prose (RDG-D145)', reask(summed, LONG_QUESTIONS).code === 2 && stop(summed).code === 2);

  const retried = transcript(reply(text(REAL_FIXED_BRIEF), askBlock(BLOCKED_ID)), hookBlocked(BLOCKED_ID), reply(emptyAssistant(), askBlock(REASK_ID)), answered(REASK_ID));
  ok('a retry with no text of its own after a hook-denied call is thin: the denial separates, the earlier summary no longer counts (KIT-T1465)', reask(retried).code === 2 && stop(retried).code === 2);

  const clarified = transcript(reply(text(REAL_FIXED_BRIEF), askBlock(BLOCKED_ID)), answered(BLOCKED_ID), reply(askBlock(REASK_ID)), answered(REASK_ID));
  ok('a re-ask after an answered questionnaire needs its own summary (KIT-T1448)', reask(clarified).code === 2);

  const shortBoth = transcript(reply(text(THIN_BRIEF), askBlock(REASK_ID)), answered(REASK_ID));
  ok('control: thin prose plus a short question stays thin, and the Counted line reports the sum', /Counted \d+ words/.test(reask(shortBoth).out) && reask(shortBoth).code === 2);
} finally {
  cleanup();
}

done();
