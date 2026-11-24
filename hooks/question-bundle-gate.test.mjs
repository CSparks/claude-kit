// question-bundle (RDG-D176, KIT-T1515): an option label that bundles several decisions ("Accept all four", "All of the above")
// lists its parts before the call; the summary above the call names each part (dry run, after-the-call audit); a term of art the
// summary never mentions is an advisory only. The design and unruled-collision drafts are the questionnaire that reached the
// maintainer with no explanation. Run: node hooks/question-bundle-gate.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { LONG_SUMMARY, gate, option, question, storeWithDecisions } from './question-gates-fixture.mjs';
import { questionGateWired } from './question-gate-wiring.mjs';
import { runGates } from '../scripts/q-gates.mjs';
import { GATES, gateDigest, gateText } from './lib/gate-protocol.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';
import { bundleLabel, bundledOptions, bundleShortfalls, unnamedParts } from './lib/question-bundle.mjs';
import { unexplainedTerms } from './lib/question-terms.mjs';
import { summaryBundleProblems } from './lib/question-explain-audit.mjs';
import { RULES } from './lib/rule-block.mjs';

const { ok, done } = reporter('question-bundle-gate');
const GATE = 'question-bundle-gate.mjs';
const AUDIT = 'question-brief-audit.mjs';
const BLOCK = 2;
const PASS = 0;
const PARTS = 'New core crate with the road web as a consumer; RON tables; ground-relative heights; archive then restore the stopped edits.';
const DESIGN = question(
  "Do you accept the planner's recommendations on crate shape, table format, height datum and the old step-2 files?", 'Design',
  [option('(Recommended) Accept all four', PARTS), option('Go through them one by one', 'Each point becomes its own question before the landing that depends on it.'), option('Reject the plan', 'Discard it; a new plan is drawn.')],
);
const UNRULED = question('What does the core do when two claims collide and no rule covers the pair?', 'Unruled', [
  option('(Recommended) Refuse in enforce mode', 'Audit mode grants it and names it; enforce mode refuses it.'), option('Grant and log it', 'Both modes grant and name the collision.'),
]);
const BARE = 'There are two questions below about the road work and the design. I recommend accepting the planner on all of it, because the plan was reviewed twice and the rulings stand. The collision question has a recommended option as well.';
const EXPLAINED = [
  'The crate shape decision: the planner puts the claiming code in a new core crate and the road web becomes one consumer of it; the cost is one more crate to build.',
  'The table format decision: the rules live in RON tables, readable text files, at the cost of a parse step at start.',
  'The height datum decision is how heights are measured: ground-relative heights, each measured from the terrain under it, so a hill does not move a building.',
  'The old step-2 files decision: the stopped edits are archived, then restored once the new crate exists, so no work is lost.',
  'Accepting all four takes the planner at its word on each.',
].join(' ');
const STORE = ['Chunks stream in rings', 'Roads carry a datum', 'Heights follow terrain', 'Collisions are named centrally', 'Pairs with no rule are unruled', 'Tables use RON', 'Saves carry a version',
  'Cameras ease with a spring', 'Menus swallow keys', 'Audio is synthesised', 'Input goes through contexts', 'Water is a shader'].map((title, i) => ({ id: `T-D${i}`, title, text: i === 4 ? 'the unruled pair is refused' : `${title} everywhere.` }));
const OWNER = [question('Does `ClaimGrid` own the cell?', 'Owner')];

try {
  ok('wired into hooks.json for AskUserQuestion (through question-gates)', questionGateWired(GATE));
  const root = storeWithDecisions();
  const run = (qs, extra = {}) => gate(GATE, root, qs, extra);

  ok('labels that bundle are recognised', ['Accept all four', '(Recommended) Accept all', 'All of the above', 'all 3', 'Approve all of them', 'Take all five'].every((l) => bundleLabel(l)));
  ok('labels that are one decision are not', ['Rebuild all 12 chunks', 'Sign all, in order', 'Keep all the caches warm', 'Accept the plan', 'Go through them one by one'].every((l) => !bundleLabel(l)));
  ok('the count a label states is read', bundleLabel('Accept all four').count === 4 && bundleLabel('All 3').count === 3 && bundleLabel('Accept all').count === 0 && bundleLabel('All of the above').ofSiblings);

  ok('the design question: the four parts are read from the option description', bundledOptions([DESIGN])[0].parts.length === 4);
  ok('control: a plain question passes the gate', run([question('Which lever goes first?', 'Lever')]).code === PASS && run([UNRULED]).code === PASS);
  ok('control: the design question with its four parts listed passes before the call (the summary decides after)', run([DESIGN]).code === PASS);

  const unlisted = question('Do you accept the plan?', 'Design', [option('(Recommended) Accept all four', 'Everything the planner proposed.'), option('Reject', 'Discard it.')]);
  const blocked = run([unlisted]);
  ok('"Accept all four" whose description lists no parts is blocked', blocked.code === BLOCK, blocked.out);
  ok('the block names the label, the stated count, the parts found, the check id, the tag form and the exclusion surface',
    blocked.out.includes('Accept all four') && blocked.out.includes('the label says 4') && blocked.out.includes('give 1 part') && blocked.out.includes('question-bundle')
    && blocked.out.includes(TOKENS.bundleChecked.form) && blocked.out.includes('.claude-kit-ignore.yaml'));
  ok('"Accept all" with no parts is blocked', run([question('Take the plan?', 'Plan', [option('(Recommended) Accept all', 'Whatever the planner wrote.'), option('Reject', 'Discard it.')])]).code === BLOCK);
  ok('a count of four over three listed parts is blocked', run([question('Take the plan?', 'Plan', [option('(Recommended) Accept all four', 'A new crate; RON tables; ground-relative heights.'), option('Reject', 'Discard it.')])]).code === BLOCK);
  const above = (...labels) => question('Which fixes ship?', 'Fixes', [option('All of the above', 'Ship every fix.'), ...labels.map((l) => option(l, 'one fix'))]);
  ok('"All of the above" over two sibling options passes before the call', run([above('Fix the lock', 'Fix the tick')]).code === PASS);
  ok('"All of the above" over one sibling option is blocked', run([above('Fix the lock')]).code === BLOCK);
  ok('[bundle-checked: ...] in the question text clears the block', run([{ ...unlisted, question: 'Do you accept the plan? [bundle-checked: the four are one reviewed plan and the summary explains it]' }]).code === PASS);
  ok('an empty tag clears nothing', run([{ ...unlisted, question: 'Do you accept the plan? [bundle-checked: ]' }]).code === BLOCK);
  ok('a single-decision label such as "Rebuild all 12 chunks" passes', run([question('What now?', 'Chunks', [option('(Recommended) Rebuild all 12 chunks', 'one rebuild'), option('Skip', 'nothing')])]).code === PASS);
  ok('request_user_input is judged the same', run([unlisted], { tool_name: 'request_user_input' }).code === BLOCK);

  writeFileSync(join(root, '.claude-kit-ignore.yaml'), 'question-bundle:\n  - "**"\n');
  ok('the ignore file lifts the gate', run([unlisted]).code === PASS);
  writeFileSync(join(root, '.claude-kit-ignore.yaml'), '');
  ok('garbage stdin fails open', hook(GATE, 'not json', root).code === PASS);
  ok('another tool is ignored', hook(GATE, { tool_name: 'Bash', tool_input: { questions: [unlisted] } }, root).code === PASS);

  const bundle = bundledOptions([DESIGN])[0];
  ok('the bare summary (names no part) leaves all four parts unnamed', unnamedParts(bundle, BARE).length === 4, unnamedParts(bundle, BARE).join(' | '));
  ok('a summary that explains each part leaves none unnamed', unnamedParts(bundle, EXPLAINED).length === 0, unnamedParts(bundle, EXPLAINED).join(' | '));
  ok('a summary that names only two parts leaves the other two unnamed', unnamedParts(bundle, 'The crate shape: a new core crate. The table format: RON tables.').length === 2);
  ok('bundleShortfalls: four parts for a count of four is sound', bundleShortfalls([bundle]).length === 0);
  ok('summaryBundleProblems: the design shape is a problem with the bare summary and none with the explained one', summaryBundleProblems(BARE, [DESIGN]).length === 1 && summaryBundleProblems(EXPLAINED, [DESIGN]).length === 0);
  ok('summaryBundleProblems: a question carrying the tag is skipped', summaryBundleProblems(BARE, [{ ...DESIGN, question: `${DESIGN.question} [bundle-checked: one reviewed plan]` }]).length === 0);

  ok('terms: a project word no sentence of the summary mentions is reported (unruled)', unexplainedTerms(BARE, [UNRULED], STORE).includes('unruled'), unexplainedTerms(BARE, [UNRULED], STORE).join(','));
  ok('terms: once the summary uses the word it is not reported', !unexplainedTerms(`${BARE} An unruled pair is two claims that collide with no rule written for them, such as a hut and a fence.`, [UNRULED], STORE).includes('unruled'));
  ok('terms: plain English the store never uses is not reported', unexplainedTerms(BARE, [question('Which lever goes first?', 'Lever')], STORE).length === 0);
  ok('terms: a `code span` the summary never mentions is reported; one it mentions is not', unexplainedTerms(BARE, OWNER, []).includes('ClaimGrid') && unexplainedTerms('ClaimGrid is the grid.', OWNER, []).length === 0);
  ok('terms: with no store only code spans are judged', unexplainedTerms(BARE, [UNRULED], []).length === 0);

  const draftDir = tmpDir('qbundle-draft-');
  const dry = async (value) => {
    const file = join(draftDir, `draft-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, JSON.stringify(value));
    let out = '';
    const code = await runGates(['question', '--draft', file], { root: adopted(false), out: { write: (s) => { out += s; } }, err: { write: () => {} } });
    return { code, out };
  };
  const bad = await dry({ summary: `${BARE} ${LONG_SUMMARY}`, questions: [DESIGN, UNRULED] });
  ok('the dry run refuses the design draft: a bundled label whose parts the summary never names', bad.code === BLOCK && /question-bundle \(summary above the call\)/.test(bad.out) && bad.out.includes('crate'), bad.out);
  ok('the dry run passes it once the summary explains each part', (await dry({ summary: `${EXPLAINED} ${LONG_SUMMARY}`, questions: [DESIGN, UNRULED] })).code === PASS);
  const calm = await dry({ summary: LONG_SUMMARY, questions: [question('Which lever goes first?', 'Lever')] });
  ok('control: the dry run passes the long summary with the shared default question', calm.code === PASS && !/WARN/.test(calm.out));
  ok('the dry run lists a gate-level bundle block through the gate', (await dry({ questions: [unlisted] })).out.includes('== question-bundle-gate =='));
  const spanned = await dry({ summary: LONG_SUMMARY, questions: OWNER });
  ok('an unexplained term is a warning, never a block: the draft passes and prints WARN', spanned.code === PASS && /WARN: Question-terms note/.test(spanned.out) && spanned.out.includes('ClaimGrid'), spanned.out);

  const auditDir = tmpDir('qbundle-audit-');
  const repoDir = adopted(false);
  let n = 0;
  const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
  const transcript = (prose, questions, id) => {
    const file = join(auditDir, `t${n++}.jsonl`);
    writeFileSync(file, [entry('user', 'Tell me where the bill stands.'), entry('assistant', [{ type: 'text', text: prose }]), entry('assistant', [{ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions } }]), entry('user', [{ type: 'tool_result', tool_use_id: id, content: 'answered' }])].join('\n'));
    return file;
  };
  const stateEnv = () => ({ CLAUDE_KIT_REAP_STAMP_DIR: tmpDir('qbundle-state-') });
  const post = (prose, questions, id) => hook(AUDIT, { hook_event_name: 'PostToolUse', session_id: 's-bundle', tool_name: 'AskUserQuestion', tool_use_id: id, tool_input: { questions }, transcript_path: transcript(prose, questions, id) }, repoDir, stateEnv());
  const stopRun = (prose, questions, id) => hook(AUDIT, { hook_event_name: 'Stop', session_id: 's-bundle', transcript_path: transcript(prose, questions, id) }, repoDir, stateEnv());
  const context = (r) => { try { return JSON.parse(r.out).hookSpecificOutput.additionalContext; } catch { return ''; } };
  const longBare = `${BARE} ${LONG_SUMMARY}`;
  ok('audit: a bundled label whose parts the summary never names is reported after the call', /Question-bundle audit/.test(context(post(longBare, [DESIGN], 'toolu_b1'))));
  ok('audit: control: the explained summary is silent', post(`${EXPLAINED} ${LONG_SUMMARY}`, [DESIGN], 'toolu_b2').out.trim() === '');
  const stop = stopRun(longBare, [DESIGN], 'toolu_b3');
  ok('audit: the Stop backstop blocks an unexplained bundle', stop.code === BLOCK && /Question-bundle audit/.test(stop.out), stop.out);
  const termsOnly = post(LONG_SUMMARY, OWNER, 'toolu_b4');
  ok('audit: an unexplained term alone is an advisory with exit 0', termsOnly.code === PASS && /Question-terms note/.test(context(termsOnly)));
  const termsStop = stopRun(LONG_SUMMARY, OWNER, 'toolu_b5');
  ok('audit: an unexplained term alone never blocks the Stop backstop', termsStop.code === PASS, termsStop.out);

  const protocol = gateText('question');
  ok('q gates question lists the check, the tag form and the hook', protocol.includes('question-bundle') && protocol.includes(TOKENS.bundleChecked.form) && GATES.question.checks.some((c) => c.tokens.includes(TOKENS.bundleChecked)) && GATES.question.hooks.includes('question-bundle-gate'));
  ok('the compaction digest names the tag', gateDigest().join('\n').includes('[bundle-checked:'));
  ok('the standing rules carry the explain-each-question rule', RULES.some((r) => /defines each term of art.*effect and cost.*no option bundles several decisions/.test(r)));
} finally {
  cleanup();
}
done();
