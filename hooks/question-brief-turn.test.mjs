// question-brief-gate against transcripts shaped as Claude Code writes them (KIT-T881): the call's own reply is not on
// disk when the hook runs, a resend finds the brief as an earlier reply, option labels carry "(Recommended) " markers
// and commas, and harness output between the brief and the call never cuts the turn.
// Run: node hooks/question-brief-turn.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { REAL_BRIEF, REAL_FIXED_BRIEF, REAL_QUESTIONS } from './question-brief-real-fixtures.mjs';

const { ok, done } = reporter('question-brief-turn');
const dir = tmpDir('question-brief-turn-');
const repoDir = adopted(false);
const CALL_ID = 'toolu_01TURN';
const SETTLED = 'In the last session you were on a bill of work. Tell me where it stands.';
const MARKER = '(Recommended) ';
const COUNTED_WORDS = 60;

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const text = (value) => ({ type: 'text', text: value });
const thinking = { type: 'thinking', thinking: '', signature: 'sig' };
const call = { type: 'tool_use', id: CALL_ID, name: 'AskUserQuestion', input: {} };
const harnessOutput = entry('user', '<local-command-stdout>Advisor set to Opus 5.5</local-command-stdout>');
const toolResult = entry('user', [{ type: 'tool_result', tool_use_id: 'toolu_01EARLIER', content: 'ok' }]);

const transcript = (lines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', SETTLED), ...lines].join('\n'));
  return file;
};
const assistant = (...blocks) => blocks.map((block) => entry('assistant', [block]));
const ask = (file, questions = REAL_QUESTIONS) => hook('question-brief-gate.mjs', { tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions }, transcript_path: file }, repoDir);
const parts = (out) => ['length', 'decision', 'evidence', 'options', 'recommendation', 'not asked'].filter((p) => out.includes(`- ${p}:`));
const withoutMarkers = REAL_QUESTIONS.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o, label: o.label.replace(MARKER, '') })) }));
const dropParagraph = (pattern) => REAL_FIXED_BRIEF.split('\n\n').filter((p) => !pattern.test(p)).join('\n\n');

try {
  const status = 'Checking the transcript of the last session first. '.repeat(COUNTED_WORDS / 8);
  const first = ask(transcript([...assistant(text(status)), toolResult]));
  ok('first call: the reply text and the call are not on disk; only earlier text is counted, the block says so and quotes what it counted',
    first.code === 2 && first.out.includes('only after hooks have run') && first.out.includes('the newest block begins "Checking the transcript'));

  const resend = ask(transcript([...assistant(text(REAL_BRIEF)), toolResult, ...assistant(thinking)]));
  ok('resend: the real brief, now an earlier reply, is read in full and blocked only on the Decision and the options it never states',
    resend.code === 2 && parts(resend.out).join() === 'decision,options');
  ok('the block names the unnamed labels exactly, with the "(Recommended) " marker and the comma gone',
    resend.out.includes('"Sign all, in order"') && resend.out.includes('"Leave them, pass the token"') && !resend.out.includes(`"${MARKER}`));
  ok('the block quotes the counted brief and says a resend changes nothing',
    resend.out.includes('Answer first') && resend.out.includes('resending changes nothing'));

  const fixedEarlier = transcript([...assistant(text(REAL_FIXED_BRIEF)), toolResult, ...assistant(thinking)]);
  ok('resend: the same brief with its Decision, Options and Recommendation written passes', ask(fixedEarlier).code === 0);
  ok('passes with the "(Recommended) " markers removed from the labels', ask(fixedEarlier, withoutMarkers).code === 0);
  const plain = REAL_FIXED_BRIEF.replace(/\*\*/g, '');
  ok('passes with no bold markers in the brief', ask(transcript([...assistant(text(plain)), toolResult, ...assistant(thinking)])).code === 0);

  const zebra = [{ ...REAL_QUESTIONS[0], options: [{ label: `${MARKER}Zebra`, description: 'an option the brief never describes' }] }];
  const zebraBlock = ask(fixedEarlier, zebra);
  ok('the marker is not part of the label: an option the brief never names is blocked even though the brief says "recommendation"',
    zebraBlock.code === 2 && zebraBlock.out.includes('"Zebra"'));

  const sameReply = transcript([...assistant(thinking, text(REAL_FIXED_BRIEF), call)]);
  ok('a reply holding the brief and the call, once on disk, passes with markers and commas in the labels', ask(sameReply).code === 0);
  ok('control: the same reply with the brief cut to its first section is blocked',
    ask(transcript([...assistant(thinking, text(REAL_FIXED_BRIEF.split('\n\n')[0]), call)])).code === 2);

  ok('harness output between the brief and the call does not cut the turn',
    ask(transcript([...assistant(text(REAL_FIXED_BRIEF)), harnessOutput, ...assistant(thinking, call)])).code === 0);

  const missing = (pattern, part) => {
    const r = ask(transcript([...assistant(text(dropParagraph(pattern))), toolResult, ...assistant(thinking)]));
    return r.code === 2 && r.out.includes(`- ${part}:`);
  };
  ok('control: no Decision statement is blocked and told the line to write', missing(/^\*\*Decision/, 'decision'));
  ok('control: no option sentences is blocked and names the labels', missing(/^\*\*Options/, 'options'));
  ok('control: no Not asked line is blocked', missing(/^\*\*Not asked/, 'not asked'));
  const noSources = REAL_FIXED_BRIEF.replace(/[\w./{},:-]*[./\\][\w./{},:-]*|\b[A-Z]+-[TD]\d+\b|\b[0-9a-f]{7,}\b|\b\w+\.\w{1,3}\b/g, 'x');
  ok('control: no sources is blocked', ask(transcript([...assistant(text(noSources)), toolResult, ...assistant(thinking)])).out.includes('- evidence:'));
  ok('control: a thin brief is blocked on length', ask(transcript([...assistant(text('Sign all, in order, or leave them.')), toolResult, ...assistant(thinking)])).out.includes('- length:'));
} finally {
  cleanup();
}

done();
