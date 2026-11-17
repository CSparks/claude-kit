// prose-ask-gate (KIT-T1130, KIT-T1136, KIT-T1151): a closing reply that asks the maintainer for approval, a decision, an
// action, or says work waits on him, in prose blocks the stop once, unless a questionnaire reached him, the reply quotes him, the turn is a subagent's, or
// he asked a question himself. Run: node hooks/prose-ask-gate.test.mjs

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ENV, HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { hasHardAsk, proseAskMatches, proseAsks } from './lib/prose-ask.mjs';
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

  const WAITING_PHRASES = [
    'Still waiting on you.', 'Waiting for you on the mesher.', 'Waiting on Chris for the go.', 'This one is your call.', 'It is up to you.',
    'That is for you to decide.', 'Two items are open for Chris.', 'I need your decision on the lane.', 'I need your call on the lane.',
    'Which one is it?', 'Do you want the second lane wired?', 'Want me to wire the second lane?', 'Let me know.',
    'Awaiting your sign-off.', 'Once you sign the bill I start.', 'Say the word and I wire it.', 'Tell me which lane to wire.',
  ];
  const asked2 = [toolUse('toolu_Q3', 'AskUserQuestion', { questions: [{ question: 'Which lane?', options: [] }] }), toolResult('toolu_Q3', 'answered')];
  for (const phrase of WAITING_PHRASES) {
    const hit = stop(turn(`Landed in 1a2b3c4. ${phrase}`));
    ok(`KIT-T1151 blocks and names the phrase: ${phrase}`, blocked(hit) && hit.out.includes('your closing reply says "'));
    ok(`KIT-T1151 negative control, questionnaire in the same turn: ${phrase}`, passed(stop(turn(`Landed in 1a2b3c4. ${phrase}`, { extra: asked2 }))));
  }
  const CONDITIONAL_OFFERS = [
    'If you meant a different private repo, or you want a snapshot pushed now regardless of build state, tell me which.',
    'If you meant the other lane, just say so.',
    'If you prefer the older layout, reply and I swap it back.',
    'If you want it pushed now, ping me.',
    'I can push a snapshot now if you want.',
    'If you would like the lane wired, I can do that next.',
    'Tell me.',
  ];
  for (const phrase of CONDITIONAL_OFFERS) {
    const hit = stop(turn(`Landed in 1a2b3c4. ${phrase}`));
    ok(`KIT-T1229 conditional offer blocks: ${phrase}`, blocked(hit) && hit.out.includes('your closing reply says "'));
    ok(`KIT-T1229 conditional offer, questionnaire in the same turn passes: ${phrase}`, passed(stop(turn(`Landed in 1a2b3c4. ${phrase}`, { extra: asked2 }))));
  }
  ok('KIT-T1229 the block text ends on the fix: make the call and report it, or send AskUserQuestion', stop(turn(`Landed. ${CONDITIONAL_OFFERS[0]}`)).out.includes('make the call and report it, or send AskUserQuestion'));
  for (const [name, reply] of [
    ['"tells me" is not "tell me"', 'The failing test tells me the mesher drops the east bend.'],
    ['an if clause with no hand-back', 'If you run the script, the output lists 12 passed.'],
    ['a plain condition on the build', 'If the build fails, the snapshot is skipped.'],
  ]) ok(`KIT-T1229 passes: ${name}`, passed(stop(turn(reply))));
  for (const [name, reply] of [
    ['inside a code fence', 'Output:\n```\nwaiting on you\nyour call\n```\nDone.'],
    ['inside an inline code span', 'The block prints `which one is it` and nothing else.'],
    ['inside double quotes', 'Chris wrote "it is up to you" about the lane, so I picked A.'],
    ['past tense', 'The worker was waiting on you for a day before the ticket closed.'],
    ['a past ask', 'You told me to let me know nothing more; the ticket landed.'],
    ['a negated want', 'He did not want me to wire the lane.'],
    ['a plain landing', 'Landed in 1a2b3c4: 12 passed. Nothing is waiting.'],
  ]) ok(`KIT-T1151 passes: ${name}`, passed(stop(turn(reply))));
  const MARKED = 'Landed.\n// claude-kit-ignore-line prose-ask\nThis one is your call.';
  ok('KIT-T1151 an in-source marker line is not read', passed(stop(turn(MARKED))));
  ok('KIT-T1151 an unmarked line next to it still blocks', blocked(stop(turn('// claude-kit-ignore-line prose-ask\nFine.\nThis one is your call.'))));

  const BRAINSTORM = [
    'Three directions for the rig.\n\nA) Bone-driven: one skeleton, blend shapes on top.\nB) Mesh-first: sculpt then retopo.\nC) Hybrid.\n\nI would pick A.\n\nWhich of these is closest to what you picture ...?',
    'Options:\n\n- **Bone-driven** -- one skeleton.\n- **Mesh-first** -- sculpt then retopo.\n\nWhich do you prefer?',
    'Two paths.\n\n1. Bone-driven.\n2. Mesh-first.\n\nI recommend 1. Does that fit the plan?',
    'Option A keeps the skeleton. Option B drops it. Is B the direction you want?',
    'The rig could go either way.\n\nWhich of these is closest to what you picture?',
    'Two lanes are viable and I have no preference.\n\nWhat do you want for the rig?',
  ];
  for (const reply of BRAINSTORM) {
    const hit = stop(turn(reply, { user: 'How should the rig work?' }));
    ok(`KIT-T1235 a closing question with options or a Which lead blocks, even after his question: ${reply.split('\n').pop()}`, blocked(hit) && hit.out.includes('your closing reply says "'));
    ok(`KIT-T1235 control, questionnaire in the same turn passes: ${reply.split('\n').pop()}`, passed(stop(turn(reply, { extra: asked2 }))));
  }
  ok('KIT-T1235 the block names the options rule', stop(turn(BRAINSTORM[0])).out.includes('brainstorming skill wording included'));
  ok('KIT-T1235 the question may be followed by a UAT line', blocked(stop(turn('The rig could go either way.\n\nWhich of these is closest to what you picture?\n\n[no-test: discussion]'))));
  for (const [name, reply] of [
    ['a numbered report with no question', 'Fixed:\n\n1. The mesher east bend.\n2. The lane count.\n\nDone in 1a2b3c4.'],
    ['a numbered report closing on a non-choice question', 'Fixed:\n\n1. The mesher east bend.\n2. The lane count.\n\nDoes that read right?'],
    ['"which" mid-sentence in a statement', 'The mesher, which drops the east bend, is fixed.'],
    ['a Which question quoted back', 'You asked "Which lane is it?" and the answer is lane 2.'],
    ['a Which question in a code span', 'The prompt `Which lane?` is gone.'],
    ['a plain statement of preference with no question', 'I would pick lane 2 and went with it.'],
    ['one lettered label only', 'A) The mesher is fixed. Anything else?'],
  ]) ok(`KIT-T1235 passes: ${name}`, passed(stop(turn(reply))));

  const ITEMS = '- **Push (RDG-Q005):** approve the framework push or hold it.\n- **Whole suites:** restart them on a quiet machine, yes or no.\n- **Near hamlet vs City:** choose the trade.';
  const rollup = (heading) => `Overnight rollup.\n\n**Landed**\n- Pockets layout (abc1234).\n- Seam steps all 0.00.\n\n${heading}\n${ITEMS}\n\n**Try next:** [no-test: nothing user-facing]`;
  for (const heading of ['**Waiting on you:**', 'Waiting on you:', '## Waiting on you', '**Needs your decision:**', 'Open for you:', 'Decisions for you:', '**Decisions needed from you**', 'Needs your input', 'Your call:', '**Questions for you:**']) {
    const hit = stop(turn(rollup(heading)));
    ok(`KIT-T1312 a rollup heading with list items blocks: ${heading}`, blocked(hit) && hit.out.includes('your closing reply says "'));
    ok(`KIT-T1312 control, questionnaire in the same turn passes: ${heading}`, passed(stop(turn(rollup(heading), { extra: asked2 }))));
  }
  const headed = stop(turn(rollup('**Decisions for you:**')));
  ok('KIT-T1312 the block names the heading, its first item, the AskUserQuestion form and the summary-first protocol', headed.out.includes('Decisions for you') && headed.out.includes('Push (RDG-Q005)')
    && /rollup heading[^]*same ask/.test(headed.out) && /one question per decision, summary first, recommended option first/.test(headed.out));
  ok('KIT-T1312 a rollup heading blocks even after his question (a hard ask)', blocked(stop(turn(rollup('**Waiting on you:**'), { user: 'What landed overnight?' }))));
  for (const [name, reply] of [
    ['a heading with no list under it', 'Overnight rollup.\n\nDecisions for you:\n\nNone tonight; the run landed.'],
    ['a negated heading', 'Landed.\n\nNothing waiting on you:\n- everything is committed.'],
    ['a heading in a code fence', 'Template:\n```\nWaiting on you:\n- item\n```\nDone.'],
    ['a heading in a blockquote', 'Pasted:\n> Decisions for you:\n> - push\n\nDone.'],
    ['a heading quoted in double quotes', 'The old rollup said "Needs your decision:" and listed items.\n- first\n- second'],
    ['an ordinary list heading', 'Landed.\n\n**Hand-backs**\n- Streets agent done.\n- Power agent done.'],
  ]) ok(`KIT-T1312 passes: ${name}`, passed(stop(turn(reply))));
  ok('KIT-T1312 a subagent report with the heading is exempt', passed(stop(turn(rollup('**Waiting on you:**')), { agent_id: 'a1b2c3d4e5f6a7b8c' })));
  ok('KIT-T1312 lib: the heading match carries the heading as its phrase and is hard', (() => {
    const [m] = proseAskMatches(rollup('Open for you:'));
    return m.hard && m.phrase === 'Open for you' && proseAsks(rollup('Open for you:')).length === 1;
  })());

  const unboundedStore = tmpDir('prose-ask-unbounded-');
  mkdirSync(join(unboundedStore, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(unboundedStore, '.ai', 'config.yml'), 'ids:\n  key: "KIT"\nuat:\n  default: manual\n');
  const bare = tmpDir('prose-ask-bare-');
  const bareStop = (reply, env) => hook(GATE, { hook_event_name: 'Stop', session_id: `bare-${RUN}-${s++}`, transcript_path: turn(reply) }, bare, { CLAUDE_KIT_BUG_STORE: unboundedStore, ...env });
  ok('KIT-T1235 a session with no repo and no unbounded store stays inert', bareStop(BRAINSTORM[0]).code === 0);
  ok('KIT-T1235 the gate runs in an unbounded session (no repo cwd)', bareStop(BRAINSTORM[0], { CLAUDE_KIT_UNBOUNDED_AI: join(unboundedStore, '.ai') }).code === 2);

  const store = tmpDir('prose-ask-store-');
  mkdirSync(join(store, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(store, '.ai', 'config.yml'), 'ids:\n  key: "KIT"\nuat:\n  default: manual\n');
  const filed = () => readdirSync(join(store, '.ai', 'tickets')).filter((f) => f.endsWith('.md') && f !== 'INDEX.md');
  const fsid = `file-${RUN}`;
  const fileCase = (text) => hook(GATE, { hook_event_name: 'Stop', session_id: fsid, transcript_path: turn(text) }, d, { CLAUDE_KIT_BUG_STORE: store });
  const firstBlock = fileCase('Landed. This one is your call.');
  ok('KIT-T1151 the block files one process-failure ticket in the kit store', firstBlock.code === 2 && filed().length === 1
    && /PROCESS FAILURE/.test(readFileSync(join(store, '.ai', 'tickets', filed()[0]), 'utf8')) && firstBlock.out.includes('filed as a process failure'));
  fileCase('Landed. It is up to you.');
  ok('KIT-T1151 a second block in the same session adds no second ticket', filed().length === 1);
  const otherSession = hook(GATE, { hook_event_name: 'Stop', session_id: `other-${RUN}`, transcript_path: turn('Landed. Waiting on you.') }, d, { CLAUDE_KIT_BUG_STORE: store });
  ok('KIT-T1151 another session files its own ticket', otherSession.code === 2 && filed().length === 2);

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
  ok('negative control: a soft ask in a reply to his own question is open discussion and passes', passed(stop(turn('The mesher is idle. Want me to wire the second lane?', { user: 'What is blocking the mesher?' }))));
  for (const hard of ['Still waiting on you.', 'This is your call.', 'It is up to you.', 'Which one is it?', 'Two items are open for Chris.']) {
    ok(`GG-D093 a hard phrase blocks even when his newest message ends in a question: ${hard}`, blocked(stop(turn(`The mesher is idle. ${hard}`, { user: 'What is blocking the mesher?' }))));
  }
  ok('GG-D093 control: a hard phrase after his question passes when a questionnaire reached him', passed(stop(turn(TICKET_REPLY, { user: 'What is blocking the mesher?', extra: asked }))));
  ok('lib: hasHardAsk is true for waiting wording only', hasHardAsk('Waiting on you.') && !hasHardAsk('Want me to wire it?') && !hasHardAsk('He wrote "your call".'));
  const negated = ['Nothing else needs your input right now.', 'Nothing is waiting on you.', 'No decision needs your input.', 'No further input needed from you.', 'I am no longer waiting on you.', 'It does not need your input.', 'Nobody is awaiting your call.'];
  for (const line of negated) ok(`KIT-T1273 a negated wait phrase passes: ${line}`, proseAsks(line).length === 0 && passed(stop(turn(`Landed the fix. ${line}`))));
  const real = ['This needs your input.', 'Nothing else, but your call on X.', 'Nothing is blocked, but it needs your input.', 'It is not trivial; your call.', 'Nothing else. Let me know.', 'Nothing yet, so up to you.'];
  for (const line of real) ok(`KIT-T1273 a real ask still blocks: ${line}`, proseAsks(line).length === 1 && blocked(stop(turn(`Landed the fix. ${line}`))));
  ok('negative control: a subagent payload (agent_id) is exempt', passed(stop(turn(TICKET_REPLY), { agent_id: 'a1b2c3d4e5f6a7b8c' })));
  ok('negative control: a sidechain transcript name is exempt', (() => {
    const sub = join(dir, 'agent-a1b2c3d4e5f6a7b8c.jsonl');
    writeFileSync(sub, [entry('user', 'Carry on.'), assistantText(TICKET_REPLY)].join('\n'));
    return passed(stop(sub));
  })());
  ok('negative control: stop_hook_active allows', passed(stop(turn(TICKET_REPLY), { stop_hook_active: true })));
  ok('negative control: mid-turn commentary is not the closing reply', passed(stop(transcript([entry('user', 'Go.'), assistantText('Want me to look at it? Looking.'), toolUse('toolu_B', 'Bash'), toolResult('toolu_B'), assistantText('Fixed.')]))));

  const HEADED_REPLY = 'Both fixes are in.\n\n**Still wrong, your call:**\n- **Steepness:** 11% of the land is steeper than 56 degrees.\n- **Flat tops:** 22% of crests stay near 635 m.';
  const MIDLINE_REPLY = 'The crest rework is in. The footprint holds. That\'s your call, I would keep 250 m.';
  const afterToolCall = (earlier, closing = UAT_RECEIPT, user = 'Carry on with the mesher.') => transcript([entry('user', user), assistantText(earlier), toolUse('toolu_M', 'Bash'), toolResult('toolu_M'), assistantText(closing)]);
  for (const [name, earlier] of [['a bulleted lead-in', HEADED_REPLY], ['a mid-message sentence', MIDLINE_REPLY]]) {
    const hit = stop(afterToolCall(earlier));
    ok(`KIT-T1332 a hard phrase in an earlier message of the turn blocks, ${name}`, blocked(hit) && hit.out.includes('your call'));
    ok(`KIT-T1332 control, questionnaire in the same turn passes, ${name}`, passed(stop(transcript([entry('user', 'Go.'), ...asked2, assistantText(earlier), toolUse('toolu_M', 'Bash'), toolResult('toolu_M'), assistantText(UAT_RECEIPT)]))));
    ok(`KIT-T1332 a hard phrase in an earlier message blocks after his question, ${name}`, blocked(stop(afterToolCall(earlier, UAT_RECEIPT, 'What changed in the crests?'))));
    ok(`KIT-T1332 a hard phrase in the closing message after earlier commentary still blocks, ${name}`, blocked(stop(afterToolCall('Looking at the crests.', earlier))));
  }
  const stopRun = JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', hookCount: 14 });
  const handBack = JSON.stringify({ type: 'user', isMeta: true, message: { role: 'user', content: '[Subagent hand-back] The text below is the final report of a subagent.' } });
  ok('KIT-T1332 a hard ask an earlier Stop run already read is not read again', passed(stop(transcript([entry('user', 'Go.'), assistantText(HEADED_REPLY), stopRun, handBack, assistantText(UAT_RECEIPT)]))));
  ok('KIT-T1332 a hard ask written after the last Stop run blocks', blocked(stop(transcript([entry('user', 'Go.'), assistantText('Earlier report.'), stopRun, handBack, assistantText(MIDLINE_REPLY), toolUse('toolu_M', 'Bash'), toolResult('toolu_M'), assistantText(UAT_RECEIPT)]))));
  ok('KIT-T1332 a quoted hard phrase in an earlier message passes', passed(stop(afterToolCall('Chris wrote "it is your call" about the lane, so I picked A.'))));
  ok('KIT-T1332 a negated hard phrase in an earlier message passes', passed(stop(afterToolCall('Nothing is waiting on you.'))));
  ok('KIT-T1332 a soft ask in an earlier message passes', passed(stop(afterToolCall('Want me to look at it? Looking.'))));

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'prose-ask:\n  - "."\n');
  ok('.claude-kit-ignore.yaml excludes the check', passed(stop(turn(TICKET_REPLY))));
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), '');

  ok('fail-open on a missing transcript', passed(stop('/no/such/file.jsonl')));
  ok('fail-open on a transcript of garbage', passed(stop(transcript(['{{{ not json', '\u0000\u0001', '[]', 'null']))));
  ok('fail-open on a payload whose last_assistant_message is not text', passed(stop(turn('Done.'), { last_assistant_message: { x: 1 } })));
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
