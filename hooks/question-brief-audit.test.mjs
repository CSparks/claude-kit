// question-brief-audit (KIT-D153, KIT-D152, KIT-T881): the summary above a questionnaire is judged after the call. PostToolUse
// reports a thin one as an advisory (exit 0, additionalContext); Stop is the backstop for calls PostToolUse never saw;
// every call is audited once and recorded; misses are counted per session and project; real questionnaires from
// groovegrid replay without a report. Run: node hooks/question-brief-audit.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { auditStop } from './question-audit-harness.mjs';
import { projectName } from './lib.mjs';
import { auditedCalls, missesSince } from './lib/question-audits.mjs';
import { REAL_BRIEF, REAL_FIXED_BRIEF, SHORT_QUESTIONS, THIN_BRIEF } from './question-brief-real-fixtures.mjs';
import { GATE_BRIEF, GATE_QUESTIONS, SHIFT_BRIEF, SHIFT_QUESTIONS } from './question-brief-replay-fixtures.mjs';

const { ok, done } = reporter('question-brief-audit');
const dir = tmpDir('question-brief-audit-');
const repoDir = adopted(false);
const SESSION = 'session-aaaa1111';
const SETTLED = 'Tell me where the bill stands.';
const AUDIT = 'question-brief-audit.mjs';

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const text = (value) => ({ type: 'text', text: value });
const callBlock = (id, questions) => ({ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions } });
const answered = (id) => entry('user', [{ type: 'tool_result', tool_use_id: id, content: 'answered' }]);
const reply = (...blocks) => blocks.map((b) => entry('assistant', [b]));
const transcript = (...lines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', SETTLED), ...lines.flat()].join('\n'));
  return file;
};
const asked = (id, brief, questions = SHORT_QUESTIONS) => transcript(reply(text(brief), callBlock(id, questions)), answered(id));
const state = () => ({ CLAUDE_KIT_REAP_STAMP_DIR: tmpDir('audit-state-') });
const post = (file, id, questions, env = state()) => hook(AUDIT, { hook_event_name: 'PostToolUse', session_id: SESSION, tool_name: 'AskUserQuestion', tool_use_id: id, tool_input: { questions }, transcript_path: file }, repoDir, env);
const stop = (file, extra = {}, env = state()) => auditStop({ session_id: SESSION, transcript_path: file, ...extra }, repoDir, env);
const advisory = (r) => { try { return JSON.parse(r.out).hookSpecificOutput; } catch { return null; } };
const silent = (r) => r.code === 0 && r.out.trim() === '';
const record = (env, fn) => {
  const keep = process.env.CLAUDE_KIT_REAP_STAMP_DIR;
  process.env.CLAUDE_KIT_REAP_STAMP_DIR = env.CLAUDE_KIT_REAP_STAMP_DIR;
  try { return fn(); } finally { if (keep === undefined) delete process.env.CLAUDE_KIT_REAP_STAMP_DIR; else process.env.CLAUDE_KIT_REAP_STAMP_DIR = keep; }
};

try {
  const wired = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks;
  const runs = (event, matcher) => (wired[event] || []).some((e) => (!matcher || e.matcher?.includes(matcher)) && e.hooks.some((h) => h.command.includes(AUDIT)));
  ok('wired for PostToolUse on AskUserQuestion and as a Stop hook', runs('PostToolUse', 'AskUserQuestion') && runs('Stop'));

  ok('replay: the real Shift+click questionnaire (summary and call in one reply) is not reported', silent(post(asked('toolu_shift', SHIFT_BRIEF, SHIFT_QUESTIONS), 'toolu_shift', SHIFT_QUESTIONS)));
  ok('replay: the real gate-fix questionnaire is not reported', silent(post(asked('toolu_gate', GATE_BRIEF, GATE_QUESTIONS), 'toolu_gate', GATE_QUESTIONS)));

  ok('replay: the real status report, which uses none of the old labels, is not reported', silent(post(asked('toolu_status', REAL_BRIEF), 'toolu_status', SHORT_QUESTIONS)));

  const status = post(asked('toolu_none', THIN_BRIEF), 'toolu_none', SHORT_QUESTIONS);
  const report = advisory(status);
  ok('a missing summary is reported as an advisory naming the summary',
    status.code === 0 && report?.hookEventName === 'PostToolUse' && report.additionalContext.includes('- summary:'));
  ok('the report is not an error: exit 0, no BLOCKED text, and it tells the model to write the summary and re-ask',
    !status.out.includes('BLOCKED') && report.additionalContext.includes('re-ask') && report.additionalContext.includes('KIT-D153'));

  const env = state();
  const thin = asked('toolu_thin', THIN_BRIEF);
  const first = post(thin, 'toolu_thin', SHORT_QUESTIONS, env);
  ok('a thin summary is reported', Boolean(advisory(first)) && first.code === 0);
  ok('a call is audited once: the same call id audited again is silent', silent(post(thin, 'toolu_thin', SHORT_QUESTIONS, env)));
  const counted = record(env, () => ({ calls: auditedCalls(), misses: missesSince({ project: projectName(repoDir), days: 1 }) }));
  ok('the call is recorded and the miss counted for its session and project', counted.calls.has('toolu_thin') && counted.misses.length === 1 && counted.misses[0].session === SESSION && counted.misses[0].count === 1);

  post(asked('toolu_thin_b', THIN_BRIEF), 'toolu_thin_b', SHORT_QUESTIONS, env);
  post(asked('toolu_sound', REAL_FIXED_BRIEF), 'toolu_sound', SHORT_QUESTIONS, env);
  ok('a second thin summary raises the count to 2, and a sound one adds nothing', record(env, () => missesSince({ project: projectName(repoDir), days: 1 })[0].count) === 2);
  const oriented = hook('orient.mjs', { hook_event_name: 'SessionStart' }, repoDir, env);
  ok('orient shows the repeat offender: the miss count, the session and the rule', oriented.out.includes('THIN QUESTIONNAIRE SUMMARIES (2 in 7 days): session- x2') && oriented.out.includes('KIT-D153'));
  ok('control: orient shows nothing when the audit record has no misses', !hook('orient.mjs', { hook_event_name: 'SessionStart' }, repoDir, state()).out.includes('THIN QUESTIONNAIRE'));
  ok('misses are per project: another project has none', record(env, () => missesSince({ project: 'some-other-project', days: 1 }).length) === 0);

  const early = post(transcript(reply(text(THIN_BRIEF))), 'toolu_early', SHORT_QUESTIONS, env);
  ok('a call not in the transcript yet is neither judged nor recorded', silent(early) && !record(env, () => auditedCalls().has('toolu_early')));

  const unaudited = transcript(reply(text(THIN_BRIEF), callBlock('toolu_late', SHORT_QUESTIONS)), answered('toolu_late'), reply(text('Waiting for your answer.')));
  const backstop = stop(unaudited);
  ok('Stop backstop: a thin questionnaire PostToolUse never saw blocks the stop with the summary rule',
    backstop.code === 2 && backstop.out.includes('- summary:') && backstop.out.includes('Question-brief audit'));
  const seen = state();
  post(unaudited, 'toolu_late', SHORT_QUESTIONS, seen);
  ok('Stop backstop: silent when PostToolUse already audited the call (no double report)', silent(stop(unaudited, {}, seen)));
  ok('Stop backstop: stop_hook_active never blocks again', silent(stop(unaudited, { stop_hook_active: true })));
  ok('Stop backstop: a sound summary is silent', silent(stop(asked('toolu_ok', REAL_FIXED_BRIEF))));
  ok('Stop backstop: a turn with no questionnaire is silent', silent(stop(transcript(reply(text('Done.'))))));
  const rescued = transcript(reply(text(THIN_BRIEF), callBlock('toolu_after', SHORT_QUESTIONS)), answered('toolu_after'), reply(text(REAL_FIXED_BRIEF)));
  ok('Stop backstop: text written after the call does not rescue a thin summary', stop(rescued).code === 2);
  const priorTurn = transcript(reply(text(THIN_BRIEF), callBlock('toolu_old', SHORT_QUESTIONS)), answered('toolu_old'), reply(text('Done.')), entry('user', 'Next ask.'), reply(text('Working on it.')));
  ok('Stop backstop: a questionnaire from an earlier turn is not audited', silent(stop(priorTurn)));

  writeFileSync(join(repoDir, '.claude-kit-ignore.yaml'), 'question-brief:\n  - "**"\n');
  ok('the question-brief ignore entry lifts the audit on both paths', silent(post(asked('toolu_ex', THIN_BRIEF), 'toolu_ex', SHORT_QUESTIONS)) && silent(stop(unaudited)));
} finally {
  cleanup();
}

done();
