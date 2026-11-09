// question-brief-gate counts every assistant text block since the last real maintainer message (KIT-T893): the
// commentary Claude Code shows between tool calls is a thinking block whose signature names "narration", a turn that
// opens with a task notification or hand-back is not cut by it, and ordinary thinking is never prose.
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
  const all = ask(transcript(entry('user', SETTLED), reply(emptyThinking, text('Still blocked: the other session holds the tree.')), taskNotification, handBack, ...perReplyBrief(), reply(emptyThinking, call)));
  ok('brief spread over narration blocks that each precede a Bash call, after a task notification and a hand-back, passes', all.code === 0);

  const newest = ask(transcript(entry('user', SETTLED), reply(text('Still blocked: the other session holds the tree.')), result('toolu_x'), reply(narration('Checking the log.'), bash('toolu_y')), result('toolu_y'), reply(call)));
  ok('control: a short text block and a short narration block are reported thin, and the blocks read list both, oldest first',
    newest.code === 2 && newest.out.indexOf('[text] "Still blocked') > 0 && newest.out.indexOf('[text] "Still blocked') < newest.out.indexOf('[narration] "Checking'));

  const sameReply = ask(transcript(entry('user', SETTLED), reply(narration(REAL_FIXED_BRIEF), call)));
  ok('a narration block in the same reply as the call counts', sameReply.code === 0);

  const privateOnly = ask(transcript(entry('user', SETTLED), reply(privateThinking(REAL_FIXED_BRIEF), call)));
  ok('control: private thinking is never prose, even when its content is a full brief', privateOnly.code === 2);

  const noMark = ask(transcript(entry('user', SETTLED), reply({ type: 'thinking', thinking: REAL_FIXED_BRIEF, signature: '' }, call)));
  ok('control: a thinking block with no signature is not narration', noMark.code === 2);

  const priorTurn = ask(transcript(entry('user', 'Earlier ask.'), reply(narration(REAL_FIXED_BRIEF), bash('toolu_p')), result('toolu_p'), reply(text('Done.')), entry('user', SETTLED), reply(call)));
  ok('control: prose from before the last real maintainer message is not counted', priorTurn.code === 2);

  const halves = HALVES.flatMap((piece, i) => [reply(narration(piece), bash(`toolu_h${i}`)), result(`toolu_h${i}`)]);
  const aloneHalf = ask(transcript(entry('user', SETTLED), halves[0], halves[1], reply(call)));
  ok('control: one half of the summary alone is too short', aloneHalf.code === 2);
  const midTurnNotice = ask(transcript(entry('user', SETTLED), halves[0], halves[1], taskNotification, halves[2], halves[3], reply(call)));
  ok('a task notification in the middle of the turn does not cut it: the narration on both sides counts', midTurnNotice.code === 0);
} finally {
  cleanup();
}

done();
