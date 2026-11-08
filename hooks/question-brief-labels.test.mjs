// A labelled brief reaches the question-brief gate only as a TEXT block (KIT-T906): Claude Code stores some commentary
// as a narration summary that drops the labelled lines. The gate counts narration (KIT-T893) but says so when the
// newest block is one, lists the blocks it read, accepts a brief written in the questionnaire's own text, and
// accepts "not in scope" as the not-asked line.
// Run: node hooks/question-brief-labels.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { auditAsk } from './question-audit-harness.mjs';
import { turnText } from './lib/turn-text.mjs';
import { gateText } from './lib/gate-protocol.mjs';

const { ok, done } = reporter('question-brief-labels');
const dir = tmpDir('question-brief-labels-');
const repoDir = adopted(false);
const CALL_ID = 'toolu_01LABEL';
const ASKED = 'The gusset bolt test is red, so get the tree green before the next landing.';
const QUESTION = 'Which way do the twelve uncommitted mine script edits go?';
const NARRATION_MARK = 'narration';
let n = 0;

const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const signature = (mark) => Buffer.concat([Buffer.from([8, 4, 18, 32]), Buffer.from(`B\t${mark}`), Buffer.from('payload')]).toString('base64');
const text = (value) => ({ type: 'text', text: value });
const narration = (value) => ({ type: 'thinking', thinking: value, signature: signature(NARRATION_MARK) });
const bash = { type: 'tool_use', id: 'toolu_bash', name: 'Bash', input: { command: 'git status' } };
const call = { type: 'tool_use', id: CALL_ID, name: 'AskUserQuestion', input: {} };
const result = entry('user', [{ type: 'tool_result', tool_use_id: 'toolu_bash', content: 'ok' }]);
const reply = (...blocks) => blocks.map((block) => entry('assistant', [block]));
const transcript = (...lines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, lines.flat().join('\n'));
  return file;
};

const FIX = 'Fix the gusset bolts piece';
const REVERT = 'Revert the mine edits to HEAD';
const LEAVE = 'Leave the mine edits as they are';
const DECISION = 'Decision: whether the twelve uncommitted mine script edits are fixed in place or reverted, needed now because the gusset bolt test fails with them present and nothing can land until one is chosen.';
const EVIDENCE = 'Evidence: assets/meshes/environment/mine/parts/mine_gusset_plate.rhai lost its piece named gusset bolts, and commit d6c27bce is the last tree where the test passes, so the loss came from one of the twelve edits and nothing else in the tree.';
const OPTIONS = [
  `${FIX} keeps your edits and costs one small restore in the gusset plate script.`,
  `${REVERT} discards all twelve edits and costs the loot scrap rewrite.`,
  `${LEAVE} changes nothing and costs a red test that stays red.`,
].join('\n');
const RECOMMENDATION = `Recommendation: ${FIX}, because it keeps your work and turns the test green again.`;
const NOT_ASKED = 'Not asked: whether the loot scrap rewrite ships, which stays open.';
const NOT_IN_SCOPE = 'Not in scope: whether the loot scrap rewrite ships.';
const brief = (...sections) => sections.join('\n\n');
const LABELLED = brief(DECISION, EVIDENCE, OPTIONS, RECOMMENDATION, NOT_ASKED);
const SUMMARY = 'The gusset bolts test fails only with your twelve uncommitted mine script edits present, so the tree cannot be called green until you choose: fixing the gusset bolts piece keeps your work and is my recommendation, while reverting to HEAD discards the edits and the loot scrap change. I will wait for your call.';

const option = (label, description, recommended = false) => ({ label: recommended ? `(Recommended) ${label}` : label, description });
const OPTION_LIST = [
  option(FIX, 'Keeps your edits and costs one small restore in the gusset plate script.', true),
  option(REVERT, 'Discards all twelve edits and costs the loot scrap rewrite.'),
  option(LEAVE, 'Changes nothing and costs a red test that stays red.'),
];
const BARE = [{ question: QUESTION, header: 'Mine edits', multiSelect: false, options: OPTION_LIST }];
const inQuestion = (...sections) => [{ question: brief(...sections), header: 'Mine edits', multiSelect: false, options: OPTION_LIST }];

const ask = (file, questions, siblingHook) => {
  const payload = { tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions }, transcript_path: file };
  return siblingHook ? hook(siblingHook, payload, repoDir) : auditAsk(payload, repoDir);
};
const storedAsText = (value) => transcript(entry('user', ASKED), reply(text(value), bash), result, reply(call));
const storedAsNarration = (value) => transcript(entry('user', ASKED), reply(narration(value), bash), result, reply(call));

try {
  const asText = ask(storedAsText(LABELLED), BARE);
  ok('the labelled brief stored as a text block passes', asText.code === 0);
  const asNarration = ask(storedAsNarration(SUMMARY), BARE);
  ok('the same brief stored only as a short narration summary is blocked', asNarration.code === 2 && asNarration.out.includes('length:'));
  ok('the block lists the narration block it read', asNarration.out.includes('Blocks read') && asNarration.out.includes('[narration] "The gusset bolts test fails only'));
  ok('the block says the platform stored a summary and points at the question text', asNarration.out.includes('narration: the platform stored a summary') && asNarration.out.includes("question text is always read"));

  const mixed = ask(transcript(entry('user', ASKED), reply(text('Checking the tree first.'), bash), result, reply(narration(SUMMARY), bash), result, reply(call)), BARE);
  ok('blocks read are listed oldest first with their kinds', mixed.out.indexOf('[text] "Checking') > 0 && mixed.out.indexOf('[text] "Checking') < mixed.out.indexOf('[narration]'));

  const textNewest = ask(storedAsText(SUMMARY), BARE);
  ok('control: a short text block as the newest block gets no narration note', textNewest.code === 2 && !textNewest.out.includes('narration: the platform stored'));

  const narrationOnly = turnText(transcript(entry('user', ASKED), reply(narration(SUMMARY), call)));
  const textReply = turnText(transcript(entry('user', ASKED), reply(text(LABELLED), call)));
  ok('a reply holding only narration is not a reply with text', narrationOnly.replyHasText === false && textReply.replyHasText === true);
  ok('turnText lists each block with its kind, newest last', narrationOnly.blocks.at(-1).kind === 'narration' && textReply.blocks.at(-1).kind === 'text' && !narrationOnly.prose.includes('Decision:'));

  const scoped = ask(storedAsText(brief(DECISION, EVIDENCE, OPTIONS, RECOMMENDATION, NOT_IN_SCOPE)), BARE);
  ok('"Not in scope" counts as the not-asked line', scoped.code === 0);
  const unsaid = ask(storedAsText(brief(DECISION, EVIDENCE, OPTIONS, RECOMMENDATION)), BARE);
  ok('control: a brief with no not-asked line is blocked on that part', unsaid.code === 2 && unsaid.out.includes('not asked:'));

  const labelledInQuestion = inQuestion(DECISION, EVIDENCE, RECOMMENDATION, NOT_ASKED);
  const viaQuestion = ask(storedAsNarration(SUMMARY), labelledInQuestion);
  ok('a narration-only turn passes when the question text holds the labelled brief', viaQuestion.code === 0);
  const sibling = ['question-gate.mjs', 'ids-described-gate.mjs'].map((name) => ask(storedAsNarration(SUMMARY), labelledInQuestion, name).code);
  ok('the same questionnaire also passes the recommendation and ids-described gates', sibling.every((code) => code === 0));

  const noRecommendation = ask(storedAsNarration(SUMMARY), inQuestion(DECISION, EVIDENCE, NOT_ASKED));
  ok('control: a question text without a Recommendation line is blocked and lists what it lacks', noRecommendation.code === 2 && /own text lacks [^\n]*recommendation/.test(noRecommendation.out));
  const shortQuestion = ask(storedAsNarration(SUMMARY), BARE);
  ok('control: the (Recommended) label marker with a bare question text leaves the recommendation lacking', /own text lacks [^\n]*recommendation/.test(shortQuestion.out));

  const protocol = gateText('question');
  ok('q gates question says the brief must be a text block and that narration cannot carry labels', protocol.includes('TEXT blocks') && protocol.includes('narration blocks are platform summaries') && !protocol.includes('(text or narration;'));
} finally {
  cleanup();
}

done();
