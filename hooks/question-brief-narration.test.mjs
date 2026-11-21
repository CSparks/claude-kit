// question-brief-audit counts the assistant text directly above the call (KIT-T893, KIT-T1448): the commentary Claude
// Code shows between tool calls is a thinking block whose signature names "narration", a task notification or hand-back
// is not a cut, a tool call or its result is, and ordinary thinking is never prose.
// Run: node hooks/question-brief-narration.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, reporter, tmpDir } from './test-harness.mjs';
import { auditAsk } from './question-audit-harness.mjs';
import { REAL_FIXED_BRIEF, SHORT_QUESTIONS } from './question-brief-real-fixtures.mjs';

const { ok, done } = reporter('question-brief-narration');
const dir = tmpDir('question-brief-narration-');
const repoDir = adopted(false);
const CALL_ID = 'toolu_01NARR';
const SETTLED = 'In the last session you were on a bill of work. Tell me where it stands.';
const NARRATION_MARK = 'narration';
const OTHER_MARK = 'plain';

let n = 0;
const entry = (type, content, extra = {}) => JSON.stringify({ type, message: { role: type, content }, ...extra });
const signature = (mark) => Buffer.concat([Buffer.from([8, 4, 18, 32]), Buffer.from(`B\t${mark}`), Buffer.from('payload')]).toString('base64');
const text = (value) => ({ type: 'text', text: value });
const narration = (value) => ({ type: 'thinking', thinking: value, signature: signature(NARRATION_MARK) });
const privateThinking = (value) => ({ type: 'thinking', thinking: value, signature: signature(OTHER_MARK) });
const emptyThinking = { type: 'thinking', thinking: '', signature: signature(OTHER_MARK) };
const bash = (id) => ({ type: 'tool_use', id, name: 'Bash', input: { command: 'git status' } });
const call = { type: 'tool_use', id: CALL_ID, name: 'AskUserQuestion', input: {} };
const result = (id) => entry('user', [{ type: 'tool_result', tool_use_id: id, content: 'ok' }]);
const reply = (...blocks) => blocks.map((block) => entry('assistant', [block]));
const taskNotification = entry('user', '<task-notification><task-id>a1</task-id><status>completed</status></task-notification>');
const handBack = entry('user', 'Another Claude session sent a message: <agent-message from="a1">[Subagent hand-back] done</agent-message>', { isMeta: true });

const transcript = (...lines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, lines.flat().join('\n'));
  return file;
};
const ask = (file) => auditAsk({ tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions: SHORT_QUESTIONS }, transcript_path: file }, repoDir);
const pieces = REAL_FIXED_BRIEF.split('\n\n');
const HALVES = ['The gusset bolts test fails only with your twelve uncommitted mine script edits present, so the tree cannot be called green until you choose.', 'Restoring the gusset bolts piece keeps your work and is what I would do, while reverting to HEAD throws the edits and the loot scrap change away.'];
const perReplyBrief = () => pieces.flatMap((piece, i) => [reply(narration(piece), bash(`toolu_${i}`)), result(`toolu_${i}`)]);

try {
  const all = ask(transcript(entry('user', SETTLED), reply(emptyThinking, text('Still blocked: the other session holds the tree.')), taskNotification, handBack, reply(narration('Checking the log.'), bash('toolu_z')), result('toolu_z'), reply(emptyThinking, narration(REAL_FIXED_BRIEF), call)));
  ok('a summary directly above the call passes after earlier tool calls, a task notification and a hand-back', all.code === 0);

  const spread = ask(transcript(entry('user', SETTLED), taskNotification, handBack, ...perReplyBrief(), reply(emptyThinking, call)));
  ok('control (KIT-T1448): a brief spread over narration blocks that each precede a Bash call is cut by the calls and reported thin', spread.code === 2);

  const newest = ask(transcript(entry('user', SETTLED), reply(text('Still blocked: the other session holds the tree.')), result('toolu_x'), reply(narration('Checking the log.'), bash('toolu_y')), result('toolu_y'), reply(call)));
  ok('control: prose above earlier tool calls is neither counted nor listed in the blocks read', newest.code === 2 && !newest.out.includes('Still blocked') && !newest.out.includes('Checking the log'));

  const sameReply = ask(transcript(entry('user', SETTLED), reply(narration(REAL_FIXED_BRIEF), call)));
  ok('a narration block in the same reply as the call counts', sameReply.code === 0);

  const privateOnly = ask(transcript(entry('user', SETTLED), reply(privateThinking(REAL_FIXED_BRIEF), call)));
  ok('control: private thinking is never prose, even when its content is a full brief', privateOnly.code === 2);

  const noMark = ask(transcript(entry('user', SETTLED), reply({ type: 'thinking', thinking: REAL_FIXED_BRIEF, signature: '' }, call)));
  ok('control: a thinking block with no signature is not narration', noMark.code === 2);

  const priorTurn = ask(transcript(entry('user', 'Earlier ask.'), reply(narration(REAL_FIXED_BRIEF), bash('toolu_p')), result('toolu_p'), reply(text('Done.')), entry('user', SETTLED), reply(call)));
  ok('control: prose from before the last real maintainer message is not counted', priorTurn.code === 2);

  const aloneHalf = ask(transcript(entry('user', SETTLED), reply(text(HALVES[0])), reply(call)));
  ok('control: one half of the summary alone is too short', aloneHalf.code === 2);
  const midTurnNotice = ask(transcript(entry('user', SETTLED), reply(narration(HALVES[0])), taskNotification, reply(narration(HALVES[1])), reply(call)));
  ok('a task notification between the halves does not cut the summary: the narration on both sides counts', midTurnNotice.code === 0);

  const PARAGRAPHS = [
    'Two levers are on the table: foliage and the parallel road sweep, and both need a decision before the perf agent builds anything.',
    '| Lever | Saves | Risk |\n| Foliage cards | 6.4 M triangles | look change |\n| Road sweep | 3.7 s | uncommitted edits |',
    '- Foliage: use the real window rows, behind a flag.\n- Sweep: wait until the other writers commit, then build it.',
  ];
  const paragraphEntries = reply(...PARAGRAPHS.map(text));
  const multi = ask(transcript(entry('user', SETTLED), paragraphEntries, reply(call)));
  ok('KIT-T1454: every text block of a multi-paragraph summary with a table and bullets counts, each in its own transcript entry', multi.code === 0);
  const mixed = ask(transcript(entry('user', SETTLED), reply(text(PARAGRAPHS[0]), narration(PARAGRAPHS[2]), text(PARAGRAPHS[1]), call)));
  ok('KIT-T1454: text and narration blocks of the same message add up', mixed.code === 0);

  const thinBlocks = ['Foliage or sweep, one lever first.', 'The sweep waits on the other writers.'];
  const thin = ask(transcript(entry('user', SETTLED), reply(text(thinBlocks[0]), text(thinBlocks[1]), call)));
  ok('KIT-T1454: a thin report names the counted words, the block count and every block with its kind and words', thin.code === 2
    && thin.out.includes('Counted 13 words in 2 blocks')
    && thin.out.includes('[text, 6 words] "Foliage or sweep, one lever first."')
    && thin.out.includes('[text, 7 words] "The sweep waits on the other writers."')
    && !thin.out.includes('Only narration blocks'));
  const onlyNarration = ask(transcript(entry('user', SETTLED), reply(narration(HALVES[0].split(' ').slice(0, 19).join(' ')), call)));
  ok('KIT-T1454: a thin report over narration blocks alone says the transcript holds the platform copy', onlyNarration.code === 2
    && onlyNarration.out.includes('[narration, 19 words]') && onlyNarration.out.includes('Only narration blocks were recorded'));
  ok('KIT-T1465: the narration note says the copy is judged at 20 words and where to write the summary so it is counted whole', /judged at 20 words instead of 40/.test(onlyNarration.out) && /write the summary as reply text \(not commentary\) directly above the call/.test(onlyNarration.out));
  const words = (count) => Array.from({ length: count }, (_, i) => `w${i}`).join(' ');
  const shortened = ask(transcript(entry('user', SETTLED), reply(narration(words(37)), call)));
  ok('KIT-T1465: a 37-word narration copy (a 170-word summary as stored) passes', shortened.code === 0 && shortened.out.trim() === '');
  ok('KIT-T1465: control: the same 37 words as reply text are thin, the 40-word bar applies', ask(transcript(entry('user', SETTLED), reply(text(words(37)), call))).code === 2);
  ok('KIT-T1465: boundary: a 19-word narration is thin, a 20-word narration passes', ask(transcript(entry('user', SETTLED), reply(narration(words(19)), call))).code === 2 && ask(transcript(entry('user', SETTLED), reply(narration(words(20)), call))).code === 0);
  const printed = ask(transcript(entry('user', SETTLED), reply(text(words(30)), call)));
  ok('KIT-T1465: a shortfall prints the counted text so it is explained, not just its first words', printed.code === 2 && printed.out.includes('w29') && /Counted 30 words in 1 block/.test(printed.out));
  const beforeTool = ask(transcript(entry('user', SETTLED), reply(text(PARAGRAPHS[0]), bash('toolu_q')), result('toolu_q'), reply(text(thinBlocks[0]), call)));
  ok('KIT-T1454: the report lists only the blocks after the previous tool call', beforeTool.code === 2 && beforeTool.out.includes('in 1 block:') && !beforeTool.out.includes('Two levers'));
} finally {
  cleanup();
}

done();
