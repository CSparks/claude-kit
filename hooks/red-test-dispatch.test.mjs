// red-test-dispatch (KIT-T1484): a closing reply or a cap / t new capture that reports failing tests, with no Agent, Task or
// SendMessage call in the turn, blocks the stop once. Run: node hooks/red-test-dispatch.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { TRIAGE_LINE } from './lib/block-triage.mjs';
import { explainsFix, redTestReports } from './lib/red-test-report.mjs';

const { ok, done } = reporter('red-test-dispatch');
const GATE = 'red-test-dispatch.mjs';
const RUN = `${process.pid}-${Date.now()}`;
const dir = tmpDir('red-test-dispatch-');

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const toolUse = (id, name, input) => entry('assistant', [{ type: 'tool_use', id, name, input }]);
const toolResult = (id, content = 'ok') => entry('user', [{ type: 'tool_result', tool_use_id: id, content }]);
const bash = (command, id) => [toolUse(id, 'Bash', { command }), toolResult(id)];
const dispatch = (id, name = 'Agent') => [toolUse(id, name, { prompt: 'fix the failing test' }), toolResult(id)];
const transcript = (reply, ...calls) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', 'Go.'), ...calls.flat(), entry('assistant', [{ type: 'text', text: reply }])].join('\n'));
  return file;
};

const REPORTS = [
  ['an N of M count', 'The lanes test file has 3 of 7 failing.'],
  ['an N/M count', 'The engine tests: 5/6 fail on main.'],
  ['a pre-existing failure', 'The towns_planned_once test is a pre-existing failure.'],
  ['a test that is red', 'The rebaked test is red.'],
  ['a passed-and-failed summary line', 'The suite ran: 116 passed, 2 failed.'],
  ['a test file name', 'fence_preview.test.mjs fails on the owner seed.'],
  ['tests that fail', 'The owner-seed junction tests fail.'],
];
const NOT_REPORTS = [
  ['a fixed test', 'The lanes test was failing; it is fixed and passes now.'],
  ['a green suite', 'The suite is green after the change.'],
  ['a zero count', '116 passed, 0 failed in the test suite.'],
  ['no failures', 'There are no failing tests.'],
  ['TDD talk', 'I wrote the failing test first, then the code.'],
  ['a negative control', 'The negative control test should fail without the fix.'],
  ['quoted words', 'He wrote "the lanes tests are failing" so I looked.'],
  ['inline code', 'Run `cargo test lanes` and read the failing output.'],
  ['a code fence', 'Output:\n```\ntest lanes ... FAILED\n3 tests failed\n```\nDone.'],
  ['a blockquote', '> the rebaked test is red\n\nNoted.'],
  ['a red colour', 'The red light on the building looks fine.'],
  ['no test noun', 'The build is red.'],
  ['a hyphenated fail-open', 'The tests cover the fail-open path.'],
];

try {
  for (const [name, text] of REPORTS) ok(`scanner flags ${name}`, redTestReports(text).length > 0);
  for (const [name, text] of NOT_REPORTS) ok(`scanner passes ${name}`, redTestReports(text).length === 0);
  ok('scanner reads a capture command raw (text inside quotes)', redTestReports('cap bug "the rebaked test is red" --project x', { raw: true }).length === 1);
  ok('explainsFix: a running fix agent', explainsFix('The fix agent for the lanes test is already running.'));
  ok('explainsFix: an ordinary reply is no explanation', !explainsFix('The lanes tests fail.'));

  const d = adopted(false);
  let s = 0;
  const stop = (file, extra = {}) => hook(GATE, { hook_event_name: 'Stop', session_id: `s${RUN}-${s++}`, transcript_path: file, ...extra }, d);

  const bare = stop(transcript('The lanes tests are failing, 3 of 7.'));
  ok('a closing reply naming failing tests with no dispatch blocks and quotes the sentence', bare.code === 2 && bare.out.includes('3 of 7') && bare.out.includes('KIT-T1484'));
  ok('the block carries the check id, both exclusion surfaces and the triage line', bare.out.includes('id: red-test-dispatch') && bare.out.includes('.claude-kit-ignore.yaml') && bare.out.includes(TRIAGE_LINE));
  ok('a cap capture naming a red test blocks even when the reply is quiet', stop(transcript('Captured.', bash('cap bug "the rebaked test is red on main" --project x', 'toolu_A'))).code === 2);
  ok('a `t new` ticket naming failing tests blocks', stop(transcript('Filed.', bash('t new bug "engine tests fail 5/6"', 'toolu_B'))).code === 2);
  ok('a non-capture shell command that prints a failing test passes', stop(transcript('Ran it.', bash('echo "the rebaked test is red"', 'toolu_C'))).code === 0);

  const sid = `repeat-${RUN}`;
  const file = transcript('The lanes tests are failing, 3 of 7.');
  const first = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  const second = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  ok('the same report blocks once per session', first.code === 2 && second.code === 0);

  const REPLY = 'The lanes tests are failing, 3 of 7.';
  ok('negative control: an Agent dispatch in the turn passes', stop(transcript(REPLY, dispatch('toolu_D'))).code === 0);
  ok('negative control: a SendMessage to the standing agent passes', stop(transcript(REPLY, dispatch('toolu_E', 'SendMessage'))).code === 0);
  ok('control: a denied dispatch does not count', stop(transcript(REPLY, [toolUse('toolu_F', 'Agent', {}), toolResult('toolu_F', 'PreToolUse:Agent hook error: [x]: blocked')])).code === 2);
  ok('negative control: a reply saying the fix agent already runs passes', stop(transcript('The lanes tests are failing, 3 of 7; the fix agent is already running.')).code === 0);
  ok('negative control: a past-tense fix passes', stop(transcript('The lanes tests were failing; fixed, all pass now.')).code === 0);
  ok('negative control: a reply with no test report passes', stop(transcript('The lane host now caches its output.')).code === 0);
  ok('negative control: a marker line is not read', stop(transcript('// claude-kit-ignore-line red-test-dispatch\nThe lanes tests are failing, 3 of 7.')).code === 0);
  ok('negative control: a subagent is exempt', stop(transcript(REPLY), { agent_id: 'a1b2c3d4e5f6a7b8c' }).code === 0);
  ok('negative control: stop_hook_active allows', stop(transcript(REPLY), { stop_hook_active: true }).code === 0);
  ok('fail-open on a missing transcript', stop('/no/such/file.jsonl').code === 0);
  ok('wired into the Stop list', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks.Stop.some((e) => e.hooks.some((h) => h.command.includes(GATE))));
} finally {
  cleanup();
}

done();
