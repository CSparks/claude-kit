// prose-ask-gate (KIT-T1130, KIT-T1136): a closing reply that asks the maintainer for approval, a decision or an action
// in prose blocks the stop once, unless a questionnaire reached him, the reply quotes him, the turn is a subagent's, or
// he asked a question himself. Run: node hooks/prose-ask-gate.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ENV, HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { proseAsks } from './lib/prose-ask.mjs';
import { TRIAGE_LINE } from './lib/block-triage.mjs';

const { ok, done } = reporter('prose-ask-gate');
const GATE = 'prose-ask-gate.mjs';
const RUN = `${process.pid}-${Date.now()}`;
const dir = tmpDir('prose-ask-');

const TICKET_REPLY = 'Landed the mesher checkpoint.\n\nStill waiting on you for the go-ahead on the volume terrain mesher next steps.';
const SECTION_REPLY = 'Ten files are inherited from the earlier agent.\n\n**One thing I need from you**\n\nThe commit-foreign override for those 10 inherited files; it needs your say before I commit.';
const UAT_RECEIPT = 'Landed in 1a2b3c4. To see it: run `node demo.mjs` and look at the east bend.';

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const assistantText = (text) => entry('assistant', [{ type: 'text', text }]);
const toolUse = (id, name, input = {}) => entry('assistant', [{ type: 'tool_use', id, name, input }]);
const toolResult = (id, content = 'ok') => entry('user', [{ type: 'tool_result', tool_use_id: id, content }]);
const transcript = (lines) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, lines.join('\n'));
  return file;
};
const turn = (reply, { user = 'Carry on with the mesher.', extra = [] } = {}) => transcript([entry('user', user), ...extra, assistantText(reply)]);

try {
  const d = adopted(false);
  let s = 0;
  const stop = (file, extra = {}) => hook(GATE, { hook_event_name: 'Stop', session_id: `s${RUN}-${s++}`, transcript_path: file, ...extra }, d);
  const blocked = (r) => r.code === 2 && r.out.includes('AskUserQuestion') && r.out.includes('prose-ask');
  const passed = (r) => r.code === 0;

  const waiting = stop(turn(TICKET_REPLY));
  ok('KIT-T1130 reply, "still waiting on you", blocks', blocked(waiting) && waiting.out.includes('Still waiting on you'));
  const section = stop(turn(SECTION_REPLY));
  ok('KIT-T1136 reply, "One thing I need from you ... it needs your say", blocks and names the sentence', blocked(section) && section.out.includes('I need from you') && proseAsks(SECTION_REPLY).length === 2);
  ok('the block says summary first and recommended first', /plain summary first/.test(waiting.out) && /\(Recommended\)/.test(waiting.out));
  ok('the block text carries the check id, both exclusion surfaces and the triage line', waiting.out.includes('id: prose-ask') && waiting.out.includes('.claude-kit-ignore.yaml') && waiting.out.includes('claude-kit-ignore-line') && waiting.out.includes(TRIAGE_LINE));
  ok('last_assistant_message is read when the payload carries it', blocked(stop(turn('Done.'), { last_assistant_message: 'Want me to wire the second lane too?' })));
  for (const phrase of ['Should I wire the second lane?', 'This is your call.', 'I need your approval for the override.', 'Say so if you want the lane wired.', 'Let me know if you want the lane wired.']) {
    ok(`blocks: ${phrase}`, blocked(stop(turn(phrase))));
  }

  const sid = `repeat-${RUN}`;
  const file = turn(TICKET_REPLY);
  const first = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  const second = hook(GATE, { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d);
  ok('the same sentence blocks once per session', first.code === 2 && second.code === 0);

  const asked = [toolUse('toolu_Q1', 'AskUserQuestion', { questions: [{ question: 'Go ahead?', options: [] }] }), toolResult('toolu_Q1', 'answered')];
  ok('negative control: a questionnaire reached him this turn', passed(stop(turn(TICKET_REPLY, { extra: asked }))));
  const denied = [toolUse('toolu_Q2', 'AskUserQuestion', { questions: [] }), toolResult('toolu_Q2', 'PreToolUse:AskUserQuestion hook error: [x]: blocked')];
  ok('control: a questionnaire a hook denied never reached him, so the reply still blocks', blocked(stop(turn(TICKET_REPLY, { extra: denied }))));
  ok('negative control: a reply quoting the maintainer passes', passed(stop(turn('You wrote "want me to wire the second lane" earlier, so I did.'))));
  ok('negative control: a blockquote and a code block pass', passed(stop(turn('Pasted back:\n> should I wire it\n\n```\nwaiting on you\n```\nDone.'))));
  ok('negative control: a UAT receipt passes', passed(stop(turn(UAT_RECEIPT))));
  ok('negative control: a plain landing report passes', passed(stop(turn('Fixed in 1a2b3c4: 12 passed. Next up: RDG-T061 (needs your bill of work signed in).'))));
  ok('negative control: a reply to his own question is open discussion and passes', passed(stop(turn(TICKET_REPLY, { user: 'What is blocking the mesher?' }))));
  ok('negative control: a subagent payload (agent_id) is exempt', passed(stop(turn(TICKET_REPLY), { agent_id: 'a1b2c3d4e5f6a7b8c' })));
  ok('negative control: a sidechain transcript name is exempt', (() => {
    const sub = join(dir, 'agent-a1b2c3d4e5f6a7b8c.jsonl');
    writeFileSync(sub, [entry('user', 'Carry on.'), assistantText(TICKET_REPLY)].join('\n'));
    return passed(stop(sub));
  })());
  ok('negative control: stop_hook_active allows', passed(stop(turn(TICKET_REPLY), { stop_hook_active: true })));
  ok('negative control: mid-turn commentary is not the closing reply', passed(stop(transcript([entry('user', 'Go.'), assistantText('Want me to look at it? Looking.'), toolUse('toolu_B', 'Bash'), toolResult('toolu_B'), assistantText('Fixed.')]))));

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'prose-ask:\n  - "."\n');
  ok('.claude-kit-ignore.yaml excludes the check', passed(stop(turn(TICKET_REPLY))));
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), '');

  ok('fail-open on a missing transcript', passed(stop('/no/such/file.jsonl')));
  ok('fail-open on malformed stdin', spawnSync(process.execPath, [join(HOOKS, GATE)], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV }).status === 0);
  ok('lib: proseAsks lists the matched sentences only', proseAsks('Fine. Should I go? Done.').length === 1 && proseAsks('').length === 0);
  ok('wired into the Stop list, not SubagentStop', (() => {
    const hooks = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks;
    const has = (event) => hooks[event].some((e) => e.hooks.some((h) => h.command.includes(GATE)));
    return has('Stop') && !has('SubagentStop');
  })());
} finally {
  cleanup();
}

done();
