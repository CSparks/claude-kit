// question-brief (KIT-T881): a recommendation or decision stated under its own label, in the forms sessions write, meets the
// brief standard; a bare pick, an option-less section and a missing section still block, and every block message gives the
// exact phrase wanted per section. Fixtures are real briefs (question-brief-fixtures.mjs).
// Run: node hooks/question-brief-sections.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, reporter, tmpDir } from './test-harness.mjs';
import { auditAsk } from './question-audit-harness.mjs';
import { NEEDS_SIGN_OFF_BRIEF, NEEDS_SIGN_OFF_QUESTIONS, SIGN_OFF_BRIEF, SIGN_OFF_QUESTIONS, SIGN_OFF_WRAPPED } from './question-brief-fixtures.mjs';

const { ok, done } = reporter('question-brief-sections');
const dir = tmpDir('question-brief-sections-');
const repoDir = adopted(false);
const SETTLED = 'Good, go with it. Ask me which one.';
const CALL_ID = 'toolu_01SECT';
let n = 0;
const line = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const ask = (prose, questions = SIGN_OFF_QUESTIONS) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [line('user', SETTLED), line('assistant', [{ type: 'text', text: prose }]), line('assistant', [{ type: 'tool_use', id: CALL_ID, name: 'AskUserQuestion', input: {} }])].join('\n'));
  return auditAsk({ tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions }, transcript_path: file }, repoDir);
};
const withRecommendation = (text) => SIGN_OFF_BRIEF.replace(/\*\*Recommendation\.\*\*[^\n]*/, text);
const blockedOn = (r, part) => r.code === 2 && r.out.includes(`- ${part}:`);

try {
  ok('the groovegrid brief (bold Recommendation label, reason as a second sentence) passes', ask(SIGN_OFF_BRIEF).code === 0);
  ok('the same recommendation soft-wrapped before "because" passes', ask(SIGN_OFF_WRAPPED).code === 0);
  ok('a "Needs your sign-off" decision section passes', ask(NEEDS_SIGN_OFF_BRIEF, NEEDS_SIGN_OFF_QUESTIONS).code === 0);
  ok('a "## Recommendation" heading over a paragraph passes',
    ask(withRecommendation('## Recommendation\n\nSign and continue in order, and leave the foreign edits alone. You dictated the bill, and the commit hooks guard each landing.')).code === 0);
  ok('a "Recommendation:" line with a "because" clause passes',
    ask(withRecommendation('Recommendation: Sign and continue in order, and leave the foreign edits alone, because you dictated the bill and the commit hooks guard each landing.')).code === 0);

  const bare = ask(withRecommendation('**Recommendation.** Sign and continue in order, and leave the foreign edits alone.'));
  ok('control: a labelled pick with no reason is blocked on the recommendation alone', blockedOn(bare, 'recommendation') && !bare.out.includes('- decision:'));
  ok('control: a labelled reason that names no option is blocked',
    blockedOn(ask(withRecommendation('**Recommendation.** Go with the quicker route. It matches the plan we agreed on last week, and nothing else moves.')), 'recommendation'));
  ok('control: a brief with no recommendation at all is blocked', blockedOn(ask(withRecommendation('')), 'recommendation'));
  ok('control: "recommend" with no reason anywhere is blocked',
    blockedOn(ask(withRecommendation('I recommend the first one.\n\nThe second is also fine.')), 'recommendation'));
  ok('control: with lettered options, a reason that opens with the article "A" and names no option is blocked',
    blockedOn(ask(NEEDS_SIGN_OFF_BRIEF.replace(/\*\*Recommendation\.\*\*[^\n]*/, '**Recommendation.** A restart costs little. It keeps the queue moving and nothing else changes.'), NEEDS_SIGN_OFF_QUESTIONS), 'recommendation'));
  ok('control: a "Needs your sign-off" label with a stub body does not satisfy the decision',
    blockedOn(ask(NEEDS_SIGN_OFF_BRIEF.replace(/\*\*Needs your sign-off\.\*\*[^\n]*/, '**Needs your sign-off.** Please.'), NEEDS_SIGN_OFF_QUESTIONS), 'decision'));

  const thin = ask('- the daemon stalled\n- pick a limit');
  const FORMATS = ['Decision: <what is being decided>', 'Evidence: <what you checked>', 'Recommendation: <option label>, because <reason>', 'Not asked: <what this leaves open'];
  ok('a thin brief gets the exact phrase wanted for each missing section', FORMATS.every((f) => thin.out.includes(f)));
  ok('the options section says to name each option as its label reads', thin.out.includes('<option label>'));
  ok('a bare pick is told what was found and what is missing',
    bare.out.includes('found a Recommendation section') && bare.out.includes('gives no reason'));
} finally {
  cleanup();
}

done();
