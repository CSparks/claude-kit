// question-brief-gate (KIT-T846, KIT-D129): an AskUserQuestion needs a brief that meets the content standard and a topic
// that is ready to ask. A full brief after a settled message passes; each missing part, an exploring maintainer
// message, a question restating his words, and the ignore file are each exercised, with controls.
// Run: node hooks/question-brief-gate.test.mjs

import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV, HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('question-brief-gate');
const OPTIONS = [
  { label: '(Recommended) Three minutes', description: 'replace a silent daemon after three minutes' },
  { label: 'Ten minutes', description: 'keep the current limit' },
];
const QUESTIONS = [{ question: 'How long may the daemon stay silent before it is replaced?', header: 'Kill limit', multiSelect: false, options: OPTIONS }];

const FULL_BRIEF = [
  'Decision: how long the broker may stay silent before a waiter replaces it, needed now because a land job sat queued for six minutes behind a hung daemon.',
  'Evidence: scripts/broker/stall.mjs holds the limit at ten minutes (RESTART_MS), and the dirt-empire log target/broker/logs/daemon-35624.log shows no beat from 01:26 to 01:32; KIT-T845 has the timeline.',
  'Option Three minutes replaces the daemon at once and costs a restart if a long step never beats, which the landing phases already protect. Option Ten minutes keeps today\'s limit and leaves a queued job waiting that long.',
  'I recommend three minutes because a wedged daemon was the only thing holding the queue and the restart restores the tree from the journal.',
  'Not being asked: the tick fix itself, which is already settled and shipped.',
].join('\n\n');

const dir = tmpDir('question-brief-');
let n = 0;
const line = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const transcript = (user, prose) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [line('user', user), line('assistant', [{ type: 'text', text: prose }])].join('\n'));
  return file;
};
const repoDir = adopted(false);
const ask = (file, questions = QUESTIONS, toolUseId) => hook('question-brief-gate.mjs', { tool_name: 'AskUserQuestion', tool_input: { questions }, ...(toolUseId ? { tool_use_id: toolUseId } : {}), ...(file ? { transcript_path: file } : {}) }, repoDir);
const SETTLED = 'Good, go with the shorter limit. Ask me which one.';

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes('question-brief-gate'))));

  ok('a full brief after a settled message passes', ask(transcript(SETTLED, FULL_BRIEF)).code === 0);

  const padded = (text) => `${text}\n\n${'The broker daemon beats every second while a command runs and the waiters poll it. '.repeat(10)}`;
  const withDecision = (line) => FULL_BRIEF.replace(/^Decision:[^\n]*/, line);
  const labelled = (line) => ask(transcript(SETTLED, padded(withDecision(line))));
  ok('a bullet "- decision: what is being decided is ..., needed now because ..." is accepted',
    labelled('- decision: what is being decided is how long the broker may stay silent before a waiter replaces it, needed now because a land job sat queued for six minutes.').code === 0);
  ok('a plain "Decision: <statement>" line with no why-now phrase is accepted',
    labelled('Decision: the waiter replaces a silent broker after a fixed number of minutes.').code === 0);
  ok('a bold label "**Decision:** ..." is accepted', labelled('**Decision:** the waiter replaces a silent broker after a fixed number of minutes.').code === 0);
  const noDecision = withDecision('The broker went quiet for six minutes on the dirt-empire log.').replace('Option Three', 'Option A').replace('I recommend', 'I advise');
  ok('control: prose with no decision statement at all is still blocked', ask(transcript(SETTLED, padded(noDecision))).out.includes('- decision:'));
  const thin = ask(transcript(SETTLED, '- the daemon stalled\n- pick a limit'));
  ok('two bullets are blocked', thin.code === 2);
  ok('the block names every part the brief lacks and both exclusion surfaces',
    ['length', 'decision', 'evidence', 'options', 'recommendation', 'not asked'].every((p) => thin.out.includes(`- ${p}:`)) && thin.out.includes('question-brief') && thin.out.includes('.claude-kit-ignore.yaml'));

  const without = (pattern) => FULL_BRIEF.split('\n\n').filter((p) => !pattern.test(p)).join('\n\n');
  const missing = (pattern, part) => { const r = ask(transcript(SETTLED, padded(without(pattern)))); return r.code === 2 && r.out.includes(`- ${part}:`); };
  ok('no evidence sources is blocked', missing(/^Evidence/, 'evidence'));
  ok('no recommendation reason is blocked', missing(/^I recommend/, 'recommendation'));
  ok('nothing said about what is not asked is blocked', missing(/^Not being asked/, 'not asked'));
  ok('options absent from the brief are blocked', missing(/^Option Three/, 'options'));
  ok('no decision statement is blocked', missing(/^Decision/, 'decision'));

  const mid = ask(transcript('should we maybe let the waiter replace the daemon sooner?', FULL_BRIEF));
  ok('an exploring maintainer message is blocked as not ready', mid.code === 2 && mid.out.includes('- exploring:') && mid.out.includes('question-ready'));
  ok('control: a question that invites the questionnaire passes', ask(transcript('what is the limit? ask me which one to pick', FULL_BRIEF)).code === 0);

  const early = `Why does the daemon stall? ${'The tick scans every result file and parses the lockfile each time. '.repeat(6)}Decided: ship the tick fix and ask me only the limit.`;
  ok('control: a question early in a long settled message is not exploring', ask(transcript(early, FULL_BRIEF)).code === 0);

  const stated = ask(transcript('Keep the daemon restart limit at three minutes with the shared cache.', FULL_BRIEF), [{ question: 'Keep the daemon restart limit at three minutes with the shared cache?', header: 'Restart', options: OPTIONS }]);
  ok('a question restating his words is blocked', stated.code === 2 && stated.out.includes('- stated:'));
  ok('control: a new question on the same topic passes', ask(transcript('Keep the daemon restart limit at three minutes with the shared cache.', FULL_BRIEF)).code === 0);

  ok('no transcript fails open', ask(null).code === 0);
  ok('an unreadable transcript fails open', ask(join(dir, 'missing.jsonl')).code === 0);
  ok('garbage stdin fails open', hook('question-brief-gate.mjs', 'not json', repoDir).code === 0);
  ok('another tool is ignored', hook('question-brief-gate.mjs', { tool_name: 'Bash', tool_input: { questions: QUESTIONS }, transcript_path: transcript(SETTLED, 'x') }, repoDir).code === 0);

  const toolResult = line('user', [{ type: 'tool_result', tool_use_id: 'toolu_01EARLIER', content: 'ok' }]);
  const realShape = (replyBlocks, earlier = []) => {
    const file = join(dir, `t${n++}.jsonl`);
    const entries = replyBlocks.map((block) => line('assistant', [block]));
    writeFileSync(file, [line('user', SETTLED), ...earlier, ...entries, line('assistant', [{ type: 'tool_use', id: 'toolu_01SHAPE', name: 'AskUserQuestion', input: {} }])].join('\n'));
    return file;
  };
  const thought = { type: 'thinking', thinking: 'I need you to pick a limit; I recommend three minutes.', signature: 'sig' };
  const NO_TEXT = 'has no text block';
  const noText = ask(realShape([thought]));
  ok('a reply of only a thinking block and the call is blocked, and the block says the reply has no text block',
    noText.code === 2 && noText.out.includes('prose has 0') && noText.out.includes(NO_TEXT));
  ok('control: a thinking block, then the brief as a text block, then the call passes', ask(realShape([thought, { type: 'text', text: FULL_BRIEF }])).code === 0);
  ok('control: a thin brief that is text gets no "no text block" note', !ask(transcript(SETTLED, 'pick a limit')).out.includes(NO_TEXT));

  const earlierStatus = [line('assistant', [{ type: 'text', text: 'Decision: the broker limit, needed now because a job queued. See KIT-T845 and scripts/broker/stall.mjs for the timeline, which I checked before this.' }]), toolResult];
  const earlierOnly = ask(realShape([thought], earlierStatus));
  ok('text from an earlier reply is counted, but a call whose own reply has no text block is told so',
    earlierOnly.code === 2 && !earlierOnly.out.includes('prose has 0') && earlierOnly.out.includes(NO_TEXT));
  ok('control: the same earlier text with a text block in the call\'s own reply carries no such note',
    !ask(realShape([thought, { type: 'text', text: 'pick a limit' }], earlierStatus)).out.includes(NO_TEXT));

  const sectioned = [
    'Decision: how long the broker may stay silent before a waiter replaces it, needed now because a land job sat queued for six minutes behind a hung daemon.',
    'Evidence: scripts/broker/stall.mjs holds the limit at ten minutes, and target/broker/logs/daemon-35624.log shows no beat for six minutes; KIT-T845 has the timeline.',
    'Options: take Three minutes, which replaces the daemon at once and costs a restart if a long step never beats; or the Ten minutes limit, which keeps today\'s value and leaves a queued job waiting.',
    'Recommendation: three minutes, because a wedged daemon was the only thing holding the queue and the restart restores the tree from the journal.',
    'Not asked: the tick fix itself, which is already settled and shipped.',
  ].join('\n');
  ok('a brief with section labels and options named loosely (stems, not the verbatim label) passes',
    ask(realShape([thought, { type: 'text', text: `${sectioned}\n\n${'The broker daemon beats every second while a command runs and the waiters poll it. '.repeat(3)}` }])).code === 0);

  const CALL_ID = 'toolu_01LAGGED';
  const LAG_MS = 700;
  const askWhileFlushing = (laggedProse) => new Promise((resolve) => {
    const file = transcript(SETTLED, 'Checking the daemon log first.');
    const child = spawn(process.execPath, [join(HOOKS, 'question-brief-gate.mjs')], { cwd: repoDir, env: ENV });
    let out = '';
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
    child.stdin.end(JSON.stringify({ tool_name: 'AskUserQuestion', tool_use_id: CALL_ID, tool_input: { questions: QUESTIONS }, transcript_path: file }));
    setTimeout(() => appendFileSync(file, `\n${line('assistant', [{ type: 'text', text: laggedProse }])}\n${line('assistant', [{ type: 'tool_use', id: CALL_ID, name: 'AskUserQuestion', input: {} }])}`), LAG_MS);
  });
  const lagged = await askWhileFlushing(FULL_BRIEF);
  ok('the reply text flushed after the hook started is counted (the call waits for its own tool_use entry)', lagged.code === 0);
  const laggedThin = await askWhileFlushing('- pick a limit');
  ok('control: a thin brief flushed late is still blocked', laggedThin.code === 2 && laggedThin.out.includes('- length:'));
  const started = Date.now();
  const noId = ask(transcript(SETTLED, FULL_BRIEF));
  ok('control: a payload with no tool_use_id reads at once', noId.code === 0 && Date.now() - started < LAG_MS * 4);

  const RADAR_QUESTIONS = [
    { question: 'Which way should the radar rotate?', header: 'Radar view', multiSelect: false, options: [{ label: '(Recommended) Heading-up', description: 'ahead is the top' }, { label: 'North-up', description: 'the map stays fixed' }] },
    { question: 'Which shape should the radar be?', header: 'Radar shape', multiSelect: false, options: [{ label: '(Recommended) Round dial', description: 'rim ticks' }, { label: 'Square panel', description: 'reuses the map panel' }] },
  ];
  const RADAR_BRIEF = [
    'Decision: how the Free Ride radar rotates and what shape it takes, needed now because the HUD landing cannot start without both.',
    'Evidence: readouts.rs:10-19 shows Free Ride has no HUD yet, and rg_ui::paint::dial in crates/rg-ui/src/paint/dial.rs already draws a round bearing dial; DE-T295 holds the plan.',
    'Heading-up keeps ahead at the top, which matches the chase camera, and costs an N tick to keep north findable. North-up leaves the map fixed, which suits learning the world, and needs mental rotation in a chase view.',
    'A Round dial puts beyond-range ticks on the rim at the true bearing, so the nearest direction always shows. A Square panel reuses the existing map panel, and gives less of a radar feel.',
    'I recommend Heading-up and the Round dial because both match the chase view and reuse tested framework parts.',
    'Not being asked: the range menu row and the distance caption, which stay open for later landings.',
  ].join('\n\n');
  const sameReply = (blocks) => {
    const file = join(dir, `t${n++}.jsonl`);
    const call = { type: 'tool_use', id: 'toolu_01RADAR', name: 'AskUserQuestion', input: { questions: RADAR_QUESTIONS } };
    writeFileSync(file, [line('user', SETTLED), ...[...blocks, call].map((block) => line('assistant', [block]))].join('\n'));
    return file;
  };
  const radar = (file) => ask(file, RADAR_QUESTIONS, 'toolu_01RADAR');
  ok('a thinking block, the full brief as a text block and the call in one reply passes, with recommended markers on the labels',
    radar(sameReply([thought, { type: 'text', text: RADAR_BRIEF }])).code === 0);
  const RADAR_THIN = 'Heading-up or North-up, Round dial or Square panel: pick.';
  const thinRadar = radar(sameReply([thought, { type: 'text', text: RADAR_THIN }]));
  ok('control: a one-line text brief naming the options is blocked, and is not told the reply has no text block',
    thinRadar.code === 2 && thinRadar.out.includes('- length:') && !thinRadar.out.includes(NO_TEXT));
  const unnamedShape = radar(sameReply([thought, { type: 'text', text: RADAR_BRIEF.replace(/Square panel|map panel/g, 'other shape') }]));
  ok('control: a full brief that never names an option is blocked for that option', unnamedShape.code === 2 && unnamedShape.out.includes('"Square panel"'));
  const seenNoText = radar(sameReply([thought]));
  ok('control: the call is in the transcript with no text block in its reply: the block says so', seenNoText.code === 2 && seenNoText.out.includes(NO_TEXT));

  const UNFLUSHED = 'has not reached the transcript';
  const unflushedReply = (earlierProse) => {
    const file = join(dir, `t${n++}.jsonl`);
    writeFileSync(file, [line('user', SETTLED), line('assistant', [{ type: 'text', text: earlierProse }])].join('\n'));
    return file;
  };
  const unflushed = radar(unflushedReply('Checking the radar plan first.'));
  ok('a call whose own reply is not in the transcript yet is blocked without claiming the reply has no text block, and is told to resend',
    unflushed.code === 2 && unflushed.out.includes(UNFLUSHED) && unflushed.out.includes('unchanged') && !unflushed.out.includes(NO_TEXT));
  ok('control: the resend, with the brief now an earlier reply of the turn, passes', radar(unflushedReply(RADAR_BRIEF)).code === 0);
  ok('control: an unflushed reply after a thin earlier text is still blocked on the missing parts', unflushed.out.includes('- length:') && unflushed.out.includes('- evidence:'));

  const thinFile = transcript(SETTLED, 'short');
  writeFileSync(join(repoDir, '.claude-kit-ignore.yaml'), 'question-brief:\n  - "**"\n');
  ok('the ignore file lifts the brief check', ask(thinFile).code === 0);
  writeFileSync(join(repoDir, '.claude-kit-ignore.yaml'), 'question-ready:\n  - "**"\n');
  ok('lifting the ready check alone leaves the brief check on', ask(thinFile).code === 2);
  ok('the ready check lifted passes an exploring message with a full brief', ask(transcript('should we maybe do it sooner?', FULL_BRIEF)).code === 0);
} finally {
  cleanup();
}

done();
