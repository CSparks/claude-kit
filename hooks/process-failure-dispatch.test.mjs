// process-failure-dispatch (KIT-D168): a process-failure capture with no Agent, Task or SendMessage call in the turn
// blocks the stop once. Run: node hooks/process-failure-dispatch.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { TRIAGE_LINE } from './lib/block-triage.mjs';

const { ok, done } = reporter('process-failure-dispatch');
const GATE = 'process-failure-dispatch.mjs';
const RUN = `${process.pid}-${Date.now()}`;
const dir = tmpDir('process-failure-dispatch-');
const CAPTURE = 'cap bug "process failure 2026-11-13: a ready decision was left in prose" --project claude-kit';

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const toolUse = (id, name, input) => entry('assistant', [{ type: 'tool_use', id, name, input }]);
const toolResult = (id, content = 'ok') => entry('user', [{ type: 'tool_result', tool_use_id: id, content }]);
const bash = (command, id) => [toolUse(id, 'Bash', { command }), toolResult(id)];
const transcript = (...calls) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', 'Go.'), ...calls.flat(), entry('assistant', [{ type: 'text', text: 'Captured.' }])].join('\n'));
  return file;
};

try {
  const d = adopted(false);
  let s = 0;
  const stop = (file, extra = {}) => hook(GATE, { hook_event_name: 'Stop', session_id: `s${RUN}-${s++}`, transcript_path: file, ...extra }, d);
  const dispatch = (id, name = 'Agent') => [toolUse(id, name, { prompt: 'fix the cause' }), toolResult(id)];

  const bare = stop(transcript(bash(CAPTURE, 'toolu_A')));
  ok('a process-failure cap with no dispatch blocks and names the capture', bare.code === 2 && bare.out.includes('process failure 2026-11-13') && bare.out.includes('KIT-D168'));
  ok('the block carries the check id, both exclusion surfaces and the triage line', bare.out.includes('id: process-failure-dispatch') && bare.out.includes('.claude-kit-ignore.yaml') && bare.out.includes(TRIAGE_LINE));
  ok('a `t new` ticket naming a process failure blocks too', stop(transcript(bash('t new bug "Process failure: the gate missed it"', 'toolu_B'))).code === 2);

  const sid = `repeat-${RUN}`;
  const file = transcript(bash(CAPTURE, 'toolu_C'));
  const first = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  const second = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  ok('the same capture blocks once per session', first.code === 2 && second.code === 0);

  ok('negative control: an Agent dispatch in the turn passes', stop(transcript(bash(CAPTURE, 'toolu_D'), dispatch('toolu_E'))).code === 0);
  ok('negative control: a SendMessage to the standing agent passes', stop(transcript(bash(CAPTURE, 'toolu_F'), dispatch('toolu_G', 'SendMessage'))).code === 0);
  ok('control: a denied dispatch does not count', stop(transcript(bash(CAPTURE, 'toolu_H'), [toolUse('toolu_I', 'Agent', {}), toolResult('toolu_I', 'PreToolUse:Agent hook error: [x]: blocked')])).code === 2);
  ok('negative control: an ordinary bug capture passes', stop(transcript(bash('cap bug "q misses a flag" --project claude-kit', 'toolu_J'))).code === 0);
  ok('negative control: a subagent is exempt', stop(transcript(bash(CAPTURE, 'toolu_K')), { agent_id: 'a1b2c3d4e5f6a7b8c' }).code === 0);
  ok('negative control: stop_hook_active allows', stop(transcript(bash(CAPTURE, 'toolu_L')), { stop_hook_active: true }).code === 0);
  ok('fail-open on a missing transcript', stop('/no/such/file.jsonl').code === 0);
  ok('wired into the Stop list', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks.Stop.some((e) => e.hooks.some((h) => h.command.includes(GATE))));
} finally {
  cleanup();
}

done();
