// question-self-contained-gate (KIT-T1448): every question's own text is a plain summary of at least 400 characters; the dialog
// shows the question text and the options only. Tags in [brackets] are cut before counting.
// Run: node hooks/question-self-contained-gate.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { QUESTION_MIN_CHARS, questionBody } from './lib/question-self-contained.mjs';
import { gateText } from './lib/gate-protocol.mjs';
import { questionGateWired } from './question-gate-wiring.mjs';

const { ok, done } = reporter('question-self-contained-gate');
const repo = adopted(false);
const OPTIONS = [{ label: '(Recommended) Restore it', description: 'keeps your edits' }, { label: 'Revert', description: 'drops them' }];
const SUMMARY = `The gusset bolts test fails only while twelve of your uncommitted mine script edits are present, so the tree cannot be called green until one of two things happens to them. Restoring the gusset bolts piece keeps all twelve edits and costs one small commit that the next landing absorbs; reverting to HEAD throws the edits and the loot scrap change away and costs a day of rework. I recommend restoring the piece because it loses nothing and the test then passes.`;
const q = (question, header = 'Mine edits') => ({ header, question, multiSelect: false, options: OPTIONS });
const run = (questions, extra = {}, cwd = repo) => hook('question-self-contained-gate.mjs', { tool_name: 'AskUserQuestion', tool_input: { questions }, ...extra }, cwd);

try {
  ok('the summary fixture clears the minimum', questionBody(SUMMARY).length >= QUESTION_MIN_CHARS);
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const entry = wiring.hooks.PreToolUse.find((e) => /AskUserQuestion/.test(e.matcher) && e.hooks.some((h) => h.command.includes('question-gates.mjs')));
  ok('wired into hooks.json on AskUserQuestion and request_user_input (through question-gates)', questionGateWired('question-self-contained-gate') && !!entry && /request_user_input/.test(entry.matcher));

  const bare = run([q('Restore it or revert?')]);
  ok('a one-line question is blocked', bare.code === 2);
  ok('the block names the check, the count, the minimum and the form to write', bare.out.includes('question-self-contained') && /\d+ characters of text, 400 required/.test(bare.out) && bare.out.includes('the decision in one sentence') && bare.out.includes('your recommendation and why'));
  ok('the block carries both exclusion surfaces and the triage line', bare.out.includes('.claude-kit-ignore.yaml') && bare.out.includes('claude-kit-ignore-start question-self-contained') && bare.out.includes('BLOCK TRIAGE'));
  ok('a summary-bearing question passes', run([q(SUMMARY)]).code === 0);
  ok('one short question among long ones blocks and is named by number', (() => {
    const r = run([q(SUMMARY), q('Which one?', 'Second')]);
    return r.code === 2 && r.out.includes('question 2 ("Second")') && !r.out.includes('question 1 (');
  })());

  const tags = '[options-checked: none apply: the matches are unrelated] '.repeat(12);
  ok('tag-only padding does not count: bracketed tags are cut before counting', run([q(`Restore it or revert? ${tags}`)]).code === 2 && questionBody(`ask ${tags}`) === 'ask');
  ok('a summary with a tag appended still passes on the summary alone', run([q(`${SUMMARY} [options-checked: none apply: unrelated]`)]).code === 0);
  ok('whitespace padding does not count', run([q(`Restore it or revert?${' '.repeat(600)}`)]).code === 2);
  ok('request_user_input is judged the same way', run([q('Short?')], { tool_name: 'request_user_input' }).code === 2);
  ok('another tool is untouched', run([q('Short?')], { tool_name: 'Bash' }).code === 0);
  ok('a payload with no questions passes', run([]).code === 0 && hook('question-self-contained-gate.mjs', { tool_name: 'AskUserQuestion', tool_input: {} }, repo).code === 0);
  ok('malformed stdin fails open', hook('question-self-contained-gate.mjs', 'not an object', repo).code === 0);

  const excluded = adopted(false);
  writeFileSync(join(excluded, '.claude-kit-ignore.yaml'), 'question-self-contained:\n  - "**"\n');
  ok('negative control: the check excluded in .claude-kit-ignore.yaml lets the one-liner through', run([q('Short?')], {}, excluded).code === 0);
  const other = adopted(false);
  writeFileSync(join(other, '.claude-kit-ignore.yaml'), 'wait-poll:\n  - "**"\n');
  ok('an exclusion of another check does not lift it', run([q('Short?')], {}, other).code === 2);

  const protocol = gateText('question');
  ok('q gates question lists the check, its rule and the hook', protocol.includes('question-self-contained') && protocol.includes('400 characters') && protocol.includes('question-self-contained-gate'));
} finally {
  cleanup();
}
done();
