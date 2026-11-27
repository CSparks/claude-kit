// open-fault-dispatch (KIT-T1611, RDG-D194): a closing reply that names open faults or failing tests, with no live agent
// on the roster, no SendMessage resume and no questionnaire in the turn, blocks the stop once.
// Run: node hooks/open-fault-dispatch.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { TRIAGE_LINE } from './lib/block-triage.mjs';
import { LIVE_ROW_WINDOW_MS } from './lib/live-roster.mjs';
import { openFaultReports } from './lib/open-fault-report.mjs';

const { ok, done } = reporter('open-fault-dispatch');
const GATE = 'open-fault-dispatch.mjs';
const RUN = `${process.pid}-${Date.now()}`;
const dir = tmpDir('open-fault-dispatch-');
const MINUTE_MS = 60 * 1000;

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const toolUse = (id, name, input) => entry('assistant', [{ type: 'tool_use', id, name, input }]);
const toolResult = (id, content = 'ok') => entry('user', [{ type: 'tool_result', tool_use_id: id, content }]);
const call = (id, name, input = {}) => [toolUse(id, name, input), toolResult(id)];
const transcript = (reply, { user = 'Go.', calls = [] } = {}) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', user), ...calls.flat(), entry('assistant', [{ type: 'text', text: reply }])].join('\n'));
  return file;
};
const rosterRow = (id, status, ageMs) => JSON.stringify({ ts: new Date(Date.now() - ageMs).toISOString(), id, status, scope: 'x:fix' });
const withRoster = (...rows) => {
  const d = adopted(false);
  writeFileSync(join(d, '.ai', 'agents.jsonl'), `${rows.join('\n')}\n`);
  return d;
};

const REPORTS = [
  ['known faults', 'Two known faults remain on the roads.'],
  ['a fault still open', 'The start-up freeze is still open.'],
  ['not fixed', 'The curb gap at the junction is not fixed.'],
  ['open bugs', 'There are three open bugs in the lane builder.'],
  ['outstanding issues', 'Outstanding issues: the kerb return overlap and the bridge seam.'],
  ['unfixed', 'The white rectangle at launch is unfixed.'],
  ['the incident status answer', 'Roads: the junction kerbs land; the known faults still open are the start-up freeze and the curb gap.'],
];
const NOT_REPORTS = [
  ['no known faults', 'There are no known faults on the roads.'],
  ['a fixed bug', 'The bug is fixed and the test passes.'],
  ['an open questionnaire', 'The questionnaire is still open.'],
  ['quoted words', 'He wrote "you have known faults still open" so I looked.'],
  ['inline code', 'The flag `--known-faults` lists them.'],
  ['the gate named in words', 'The open fault gate blocks once per sentence.'],
  ['the gate named by id', 'The open-fault-dispatch gate landed.'],
  ['a plain landing', 'The lane host now caches its output.'],
  ['all fixed', 'All three bugs are fixed.'],
];

try {
  for (const [name, text] of REPORTS) ok(`scanner flags ${name}`, openFaultReports(text).length > 0);
  for (const [name, text] of NOT_REPORTS) ok(`scanner passes ${name}`, openFaultReports(text).length === 0);

  const d = adopted(false);
  let s = 0;
  const stop = (file, cwd = d, extra = {}) => hook(GATE, { hook_event_name: 'Stop', session_id: `s${RUN}-${s++}`, transcript_path: file, ...extra }, cwd);
  const REPLY = 'The start-up freeze is still open and the curb gap is not fixed.';

  const bare = stop(transcript(REPLY));
  ok('open faults with no live agent block and quote the sentence', bare.code === 2 && bare.out.includes('start-up freeze') && bare.out.includes('RDG-D194'));
  ok('the block names dispatch and the questionnaire', bare.out.includes('Dispatch the next fault') && bare.out.includes('AskUserQuestion'));
  ok('the block carries the check id, both exclusion surfaces and the triage line', bare.out.includes('id: open-fault-dispatch') && bare.out.includes('.claude-kit-ignore.yaml') && bare.out.includes(TRIAGE_LINE));
  ok('a status question does not exempt the turn', stop(transcript(REPLY, { user: 'Where do things sit right now with roads?' })).code === 2);
  ok('failing tests named with no live agent block', stop(transcript('The lanes tests are failing, 3 of 7.')).code === 2);
  ok('a foreground agent that returned leaves the turn idle: blocks', stop(transcript(REPLY, { calls: [call('toolu_A', 'Agent', { prompt: 'fix it' })] })).code === 2);

  const sid = `repeat-${RUN}`;
  const file = transcript(REPLY);
  const first = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  const second = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  ok('the same sentence blocks once per session', first.code === 2 && second.code === 0);

  ok('negative control: a live in-flight roster row passes', stop(transcript(REPLY), withRoster(rosterRow('alive0001', 'in-flight', 5 * MINUTE_MS))).code === 0);
  ok('control: a finished roster row blocks', stop(transcript(REPLY), withRoster(rosterRow('done00001', 'in-flight', 9 * MINUTE_MS), rosterRow('done00001', 'done', MINUTE_MS))).code === 2);
  ok('control: an in-flight row older than the live window blocks', stop(transcript(REPLY), withRoster(rosterRow('orphan001', 'in-flight', LIVE_ROW_WINDOW_MS + MINUTE_MS))).code === 2);
  ok('negative control: a questionnaire that reached him passes', stop(transcript(REPLY, { calls: [call('toolu_Q', 'AskUserQuestion')] })).code === 0);
  ok('control: a denied questionnaire does not count', stop(transcript(REPLY, { calls: [[toolUse('toolu_D', 'AskUserQuestion', {}), toolResult('toolu_D', 'PreToolUse:AskUserQuestion hook error: [x]: blocked')]] })).code === 2);
  ok('negative control: a SendMessage resume passes', stop(transcript(REPLY, { calls: [call('toolu_S', 'SendMessage', { to: 'a1', message: 'next fault' })] })).code === 0);
  ok('negative control: a reply with no open fault passes', stop(transcript('The lane host now caches its output.')).code === 0);
  ok('negative control: a marker line is not read', stop(transcript(`// claude-kit-ignore-line open-fault-dispatch\n${REPLY}`)).code === 0);
  ok('negative control: a subagent is exempt', stop(transcript(REPLY), d, { agent_id: 'a1b2c3d4e5f6a7b8c' }).code === 0);
  ok('negative control: stop_hook_active allows', stop(transcript(REPLY), d, { stop_hook_active: true }).code === 0);
  ok('fail-open on a missing transcript', stop('/no/such/file.jsonl').code === 0);
  const bareDir = tmpDir('open-fault-unadopted-');
  mkdirSync(join(bareDir, 'x'), { recursive: true });
  ok('negative control: an unadopted folder passes', stop(transcript(REPLY), bareDir).code === 0);
  ok('wired into the Stop list', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks.Stop.some((e) => e.hooks.some((h) => h.command.includes(GATE))));
} finally {
  cleanup();
}

done();
