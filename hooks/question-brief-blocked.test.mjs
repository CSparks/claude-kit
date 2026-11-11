// question-brief-audit and a questionnaire a PreToolUse hook denied (KIT-T1060): a denied call never reached the
// maintainer, so the Stop backstop does not judge it; the re-ask is judged over all the turn's prose; the
// questionnaire's own question text adds to the prose count instead of replacing it.
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
    reply(askBlock(REASK_ID, LONG_QUESTIONS)), answered(REASK_ID),
  );
  ok('Stop: a hook-denied call is not judged, so the real shape (short narration summary, denied call, one line, answered re-ask) is silent', silent(stop(realShape)));

  const longThenBlocked = transcript(
    reply(text(REAL_FIXED_BRIEF), askBlock(BLOCKED_ID)), hookBlocked(BLOCKED_ID),
    reply(text(ONE_LINE), askBlock(REASK_ID)), answered(REASK_ID),
  );
  ok('guard: a long reply, a denied call, a one-line narration and a re-ask is silent on Stop', silent(stop(longThenBlocked)));
  ok('guard: the re-ask judged on PostToolUse counts the long reply before the denied call', silent(reask(longThenBlocked)));

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
  ok('the 30-word prose plus the 30-word question text passes: question text adds to the count', silent(reask(summed, LONG_QUESTIONS)) && silent(stop(summed)));

  const shortBoth = transcript(reply(text(THIN_BRIEF), askBlock(REASK_ID)), answered(REASK_ID));
  ok('control: thin prose plus a short question stays thin, and the Counted line reports the sum', /Counted \d+ words/.test(reask(shortBoth).out) && reask(shortBoth).code === 2);
} finally {
  cleanup();
}

done();
