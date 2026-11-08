// question-brief-audit on transcripts shaped as Claude Code writes them (KIT-T881, KIT-D152): the summary and the
// questionnaire in one reply, option labels with "(Recommended) " markers and commas, harness output between the
// summary and the call, and a thin summary reported with what to write. The audit judges only what precedes the call.
// Run: node hooks/question-brief-turn.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, reporter, tmpDir } from './test-harness.mjs';
import { auditAsk } from './question-audit-harness.mjs';
import { REAL_BRIEF, REAL_FIXED_BRIEF, REAL_QUESTIONS } from './question-brief-real-fixtures.mjs';

const { ok, done } = reporter('question-brief-turn');
const dir = tmpDir('question-brief-turn-');
const repoDir = adopted(false);
const CALL_ID = 'toolu_01TURN';
const SETTLED = 'In the last session you were on a bill of work. Tell me where it stands.';
const MARKER = '(Recommended) ';

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const text = (value) => ({ type: 'text', text: value });
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
const parts = (out) => ['length', 'decision', 'evidence', 'options', 'recommendation', 'not asked'].filter((p) => out.includes(`- ${p}:`));
const withoutMarkers = REAL_QUESTIONS.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o, label: o.label.replace(MARKER, '') })) }));
const dropParagraph = (pattern) => REAL_FIXED_BRIEF.split('\n\n').filter((p) => !pattern.test(p)).join('\n\n');
const sameReply = (brief) => transcript([...assistant(thinking, text(brief), call), answer]);

try {
  const full = sameReply(REAL_FIXED_BRIEF);
  ok('the summary and the call in one reply, summary complete: no advisory, with markers and commas in the labels', ask(full).code === 0);
  ok('passes with the "(Recommended) " markers removed from the labels', ask(full, withoutMarkers).code === 0);
  ok('passes with no bold markers in the brief', ask(sameReply(REAL_FIXED_BRIEF.replace(/\*\*/g, ''))).code === 0);

  const thin = ask(sameReply(REAL_BRIEF));
  ok('the real status report as the summary is reported, exit 0, naming exactly the Decision and the options it never states',
    thin.code === 2 && parts(thin.out).join() === 'decision,options');
  ok('the report names the unnamed labels with the "(Recommended) " marker and the comma gone',
    thin.out.includes('"Sign all, in order"') && thin.out.includes('"Leave them, pass the token"') && !thin.out.includes(`"${MARKER}`));
  ok('the report is advisory text, not a BLOCKED error, and tells the model to write the parts and re-ask',
    !thin.out.includes('BLOCKED') && thin.out.includes('Question-brief audit') && thin.out.includes('re-ask'));

  const marker = [{ ...REAL_QUESTIONS[0], options: [{ label: `${MARKER}Zebra`, description: 'an option the brief never describes' }] }];
  const zebra = ask(full, marker);
  ok('the marker is not part of the label: an option the brief never names is reported even though the brief says "recommendation"',
    zebra.code === 2 && zebra.out.includes('"Zebra"'));

  ok('harness output between the summary and the call does not cut the turn',
    ask(transcript([...assistant(text(REAL_FIXED_BRIEF)), harnessOutput, ...assistant(thinking, call), answer])).code === 0);
  ok('text written after the call never rescues a thin summary',
    ask(transcript([...assistant(thinking, text(REAL_BRIEF), call), answer, ...assistant(text(REAL_FIXED_BRIEF))])).code === 2);
  ok('a call that is not in the transcript yet is not audited', ask(transcript([...assistant(text(REAL_BRIEF))])).code === 0);

  const missing = (pattern, part) => {
    const r = ask(sameReply(dropParagraph(pattern)));
    return r.code === 2 && r.out.includes(`- ${part}:`);
  };
  ok('control: no Decision statement is reported with the line to write', missing(/^\*\*Decision/, 'decision'));
  ok('control: no option sentences is reported with the labels', missing(/^\*\*Options/, 'options'));
  const noRecommendation = ask(sameReply(dropParagraph(/^\*\*Recommendation/).replace(/recommend/gi, 'suggest')));
  ok('control: no Recommendation is reported', noRecommendation.code === 2 && noRecommendation.out.includes('- recommendation:'));
  ok('control: no Not asked line is reported', missing(/^\*\*Not asked/, 'not asked'));
  const noSources = REAL_FIXED_BRIEF.replace(/[\w./{},:-]*[./\\][\w./{},:-]*|\b[A-Z]+-[TD]\d+\b|\b[0-9a-f]{7,}\b|\b\w+\.\w{1,3}\b/g, 'x');
  ok('control: no sources is reported', ask(sameReply(noSources)).out.includes('- evidence:'));
  ok('control: a thin summary is reported on length', ask(sameReply('Sign all, in order, or leave them.')).out.includes('- length:'));
} finally {
  cleanup();
}

done();
