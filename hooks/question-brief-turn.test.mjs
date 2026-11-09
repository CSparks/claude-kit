// question-brief-audit on transcripts shaped as Claude Code writes them (KIT-D153, KIT-T881, KIT-T906): the audit
// judges only that a plain summary of reasonable length came before the questionnaire, whatever its wording, whether
// stored as text, as a narration summary, or written in the question text. Run: node hooks/question-brief-turn.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { auditAsk } from './question-audit-harness.mjs';
import { REAL_BRIEF, REAL_FIXED_BRIEF, REAL_QUESTIONS, SHORT_QUESTIONS } from './question-brief-real-fixtures.mjs';
import { gateText } from './lib/gate-protocol.mjs';

const { ok, done } = reporter('question-brief-turn');
const dir = tmpDir('question-brief-turn-');
const repoDir = adopted(false);
const CALL_ID = 'toolu_01TURN';
const SETTLED = 'In the last session you were on a bill of work. Tell me where it stands.';
const MARKER = '(Recommended) ';
const NARRATION_MARK = 'narration';

const PLAIN_SUMMARY = 'The gusset bolts test fails only with your twelve uncommitted mine script edits present, so the tree cannot be called green until you choose. Restoring the gusset bolts piece keeps your work and is what I would do, while reverting to HEAD throws the edits and the loot scrap change away.';
const SHORT_QUESTION = SHORT_QUESTIONS;

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const signature = (mark) => Buffer.concat([Buffer.from([8, 4, 18, 32]), Buffer.from(`B\t${mark}`), Buffer.from('payload')]).toString('base64');
const text = (value) => ({ type: 'text', text: value });
const narration = (value) => ({ type: 'thinking', thinking: value, signature: signature(NARRATION_MARK) });
const thinking = { type: 'thinking', thinking: '', signature: 'sig' };
const call = { type: 'tool_use', id: CALL_ID, name: 'AskUserQuestion', input: {} };
const harnessOutput = entry('user', '<local-command-stdout>Advisor set to Opus 5.5</local-command-stdout>');
const answer = entry('user', [{ type: 'tool_result', tool_use_id: CALL_ID, content: 'answered' }]);

const transcript = (lines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', SETTLED), ...lines].join('\n'));
  return file;
};
const assistant = (...blocks) => blocks.map((block) => entry('assistant', [block]));
const ask = (file, questions = REAL_QUESTIONS) => auditAsk({ tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions }, transcript_path: file }, repoDir);
const sameReply = (brief) => transcript([...assistant(thinking, text(brief), call), answer]);
const noSummary = () => transcript([...assistant(thinking, call), answer]);

try {
  ok('a plain summary before the call passes', ask(sameReply(PLAIN_SUMMARY), SHORT_QUESTION).code === 0);
  ok('a summary with no label, no source and no "recommend" or "because" still passes',
    ask(sameReply(PLAIN_SUMMARY.replace(/recommend\w*|because/gi, 'say')), SHORT_QUESTION).code === 0);
  ok('the real status report, which never used the old labels, passes', ask(sameReply(REAL_BRIEF)).code === 0);
  ok('the labelled brief still passes', ask(sameReply(REAL_FIXED_BRIEF)).code === 0);
  ok('passes with the "(Recommended) " markers removed from the labels',
    ask(sameReply(PLAIN_SUMMARY), SHORT_QUESTION.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o, label: o.label.replace(MARKER, '') })) }))).code === 0);

  const none = ask(noSummary(), SHORT_QUESTION);
  ok('no summary at all is reported as advisory text naming the summary, with the re-ask instruction',
    none.code === 2 && none.out.includes('- summary:') && none.out.includes('re-ask') && none.out.includes('KIT-D153') && !none.out.includes('BLOCKED'));
  ok('a one-line summary is reported', ask(sameReply('Sign all, in order, or leave them.'), SHORT_QUESTION).code === 2);
  ok('the report asks for no label and no sentence shape', !/Decision:|Evidence:|Not asked:|Recommendation:/.test(none.out));

  ok('a summary stored only as a narration block passes', ask(transcript([...assistant(narration(PLAIN_SUMMARY), call), answer]), SHORT_QUESTION).code === 0);
  const inQuestion = [{ ...SHORT_QUESTION[0], question: `${PLAIN_SUMMARY} Which way do the mine edits go?` }];
  ok('a summary written in the question text passes when the turn has none', ask(noSummary(), inQuestion).code === 0);
  const longOptionsOnly = [{ ...SHORT_QUESTION[0], options: SHORT_QUESTION[0].options.map((o) => ({ ...o, description: PLAIN_SUMMARY })) }];
  ok('control: long option descriptions are not a summary', ask(noSummary(), longOptionsOnly).code === 2);

  ok('harness output between the summary and the call does not cut the turn',
    ask(transcript([...assistant(text(PLAIN_SUMMARY)), harnessOutput, ...assistant(thinking, call), answer]), SHORT_QUESTION).code === 0);
  ok('text written after the call never rescues a missing summary',
    ask(transcript([...assistant(thinking, call), answer, ...assistant(text(PLAIN_SUMMARY))]), SHORT_QUESTION).code === 2);
  ok('a call that is not in the transcript yet is not audited', ask(transcript([...assistant(text('Short.'))])).code === 0);

  const lastMarked = [{ ...SHORT_QUESTION[0], options: [{ label: 'Restore the piece', description: 'keeps your edits' }, { label: `${MARKER}Revert to HEAD`, description: 'drops them' }] }];
  const mislabelled = hook('question-gate.mjs', { tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions: lastMarked } }, repoDir);
  ok('the (Recommended)-first check still fails a question whose recommended option is not first', mislabelled.code === 2 && mislabelled.out.includes('not FIRST'));

  const protocol = gateText('question');
  ok('q gates question prints the one rule: summary first, then the questionnaire, with no label list',
    protocol.includes('summary first, then the questionnaire') && protocol.includes('KIT-D153') && !protocol.includes('Decision:') && !protocol.includes('Not asked'));
} finally {
  cleanup();
}

done();
