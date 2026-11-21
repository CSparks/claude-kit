// KIT-T1451: a self-contained questionnaire passes the questionnaire gates on the first try, a true restatement still blocks.
// Superseded decisions never match; a long summary is judged sentence by sentence; an [options-checked: <ids> govern this; ...]
// tag with ids in force clears loose matches and is never itself matched or described; one refusal lists every failing check;
// `q gates question --draft` is the dry run. Run: node hooks/question-gates-first-try.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';
import { LONG_SUMMARY, gate, option, question, storeWithDecisions } from './question-gates-fixture.mjs';
import { runGates } from '../scripts/q-gates.mjs';
import { QUESTION_GATES, runQuestionGates } from './lib/question-gates-run.mjs';
import { GATES } from './lib/gate-protocol.mjs';
import { storeDocs } from './lib/store-docs.mjs';
import { supersededIds } from './lib/superseded-decisions.mjs';

const { ok, done } = reporter('question-gates-first-try');
const GROUNDED = 'question-grounded-gate.mjs';
const IDS = 'ids-described-gate.mjs';
const DECISION_GATE = 'decision-gate.mjs';
const TAG = (ids) => `[options-checked: ${ids} govern this; no other recorded decision applies]`;
const BLOCK = 2;
const PASS = 0;

try {
  const root = storeWithDecisions();
  const docs = storeDocs(root);
  const ids = docs.map((d) => d.id);

  ok('a decision another decision supersedes (title phrase) is out of the store docs', !ids.includes('FQD-D020') && ids.includes('FQD-D021'));
  ok('supersededIds reads the supersedes field, the title phrase and a list of ids', (() => {
    const found = supersededIds(['---\nid: XX-D2\ntitle: new\nsupersedes: XX-D1\n---\n', '---\nid: XX-D9\ntitle: newer (supersedes XX-D5 and XX-D6)\n---\n']);
    return found.has('XX-D1') && found.has('XX-D5') && found.has('XX-D6') && !found.has('XX-D2');
  })());

  const patched = question('The pooled upload path needs a decision on the allocator.', 'Allocator', [option('(Recommended) The framework carries a patched allocator', 'the patched allocator builds the pooled upload path now'), option('Leave it', 'nothing changes')]);
  const replaced = gate(GROUNDED, root, [patched]);
  ok('a questionnaire that restates a superseded decision never names it (the replacing decision is what matches)', !/FQD-D020/.test(replaced.out) && /FQD-D021/.test(replaced.out));
  const live = question('The allocator stays unpatched and the pooled upload path uses the public surface.', 'Allocator', [option('(Recommended) Keep going', 'builds on it'), option('Leave it', 'nothing changes')]);
  ok('control: restating the replacing decision still blocks', gate(GROUNDED, root, [live]).code === BLOCK);

  ok('a long summary of loose sentences passes the grounded gate', gate(GROUNDED, root, [question(LONG_SUMMARY)]).code === PASS);

  const RESTATES = "A test run on the framework, a single crate or the whole suite, requires the maintainer's sign-off before it starts; no agent runs cargo test on its own judgement.";
  const restatement = question(RESTATES, 'Tests');
  ok('negative control: a true restatement of the test-run rule blocks', gate(GROUNDED, root, [restatement]).code === BLOCK && /FQD-D010/.test(gate(GROUNDED, root, [restatement]).out));
  const tagged = question(`${RESTATES} ${TAG('FQD-D030')}`, 'Tests');
  ok('negative control: a near-verbatim restatement still blocks with a valid tag', gate(GROUNDED, root, [tagged]).code === BLOCK);

  const loose = question('Agents verify with cargo check, later the coordinator batches approved runs for the harbour scene: should that change?', 'Suite');
  const looseUntagged = gate(GROUNDED, root, [loose]);
  const looseTagged = gate(GROUNDED, root, [{ ...loose, question: `${loose.question} ${TAG('FQD-D030')}` }]);
  ok('a loose overlap with a decision (a run of shared words) blocks untagged', looseUntagged.code === BLOCK, looseUntagged.out);
  ok('KIT-T1457: a tag naming only another decision in force does not clear the loose match: the block names FQD-D010', looseTagged.code === BLOCK && /FQD-D010/.test(looseTagged.out), looseTagged.out);
  const namedBoth = gate(GROUNDED, root, [{ ...loose, question: `${loose.question} ${TAG('FQD-D030, FQD-D010')}` }]);
  ok('control: the tag that names the matched decision as well passes', namedBoth.code === PASS, namedBoth.out);
  const fake = gate(GROUNDED, root, [{ ...loose, question: `${loose.question} ${TAG('FQD-D999')}` }]);
  ok('a tag that names an id the store does not hold clears nothing', fake.code === BLOCK);
  const gone = gate(GROUNDED, root, [{ ...loose, question: `${loose.question} ${TAG('FQD-D020')}` }]);
  ok('a tag that names only a superseded id clears nothing', gone.code === BLOCK);
  const quoting = question(`The options differ on the framework crate suite and the cargo check. ${TAG('FQD-D030')} (FQD-D010: every framework test run needs the maintainer's sign-off before it starts)`, 'Suite');
  ok('the tag text is never matched: quoting a loose match inside the tag does not trigger it', gate(GROUNDED, root, [quoting]).code === PASS);
  ok('KIT-T1457: a blanket "none apply" tag clears no clause match', gate(GROUNDED, root, [{ ...loose, question: `${loose.question} [options-checked: none apply: the matches are loose words]` }]).code === BLOCK);
  ok('a "none apply" tag that names the matched decision passes', gate(GROUNDED, root, [{ ...loose, question: `${loose.question} [options-checked: none apply: FQD-D010 is about framework runs, this is the harbour scene]` }]).code === PASS);

  const PERSIST = 'Persist the road network and settlement plans on disk, keyed on seed, world documents and the code that cooks them, and read them back on a repeat of the same seed.';
  const persist = (extra = '') => question(`How far should same-seed persistence go? ${extra}`, 'Persist', [option('(Recommended) World build first', PERSIST), option('Persist nothing', 'Keep startup as it is.')]);
  const BLANKET = '[options-checked: FQD-D030 (default menus) and FQD-D040 (pop-in) govern; no other recorded decision applies]';
  const surfaced = gate(GROUNDED, root, [persist(BLANKET)]);
  ok('KIT-T1457: a persistence question with a blanket tag naming other ids still surfaces the caching decision', surfaced.code === BLOCK && /FQD-D031/.test(surfaced.out), surfaced.out);
  ok('control: naming both persistence decisions in the tag passes', gate(GROUNDED, root, [persist('[options-checked: FQD-D031 (every deterministic output is cached on disk) and FQD-D146 (world data persists by cache age) govern]')]).code === PASS);
  ok('control: the same persistence question cites nothing and is blocked untagged', gate(GROUNDED, root, [persist()]).code === BLOCK);

  const cited = question('Does FQD-D030 need an override for the harbour menu?', 'Menu');
  ok('an id in the question body without its plain words blocks ids-described', gate(IDS, root, [cited]).code === BLOCK);
  const block = gate(IDS, root, [cited]).out;
  ok('the block carries a ready-to-paste "<title> (<id>)" line', /paste: "A new game gets default menus and a settings screen by convention \(FQD-D030\)"/.test(block));
  ok('an id inside the options-checked tag needs no description', gate(IDS, root, [question(`Does the harbour menu need an override? ${TAG('FQD-D030')}`, 'Menu')]).code === PASS);
  ok('the tag text never counts as the plain words that describe an id', gate(IDS, root, [question(`Does FQD-D030 need an override? [options-checked: default menus and a settings screen by convention govern this; FQD-D030]`, 'Menu')]).code === BLOCK);

  const titleSentence = question('A new game gets default menus and a settings screen by convention: do we keep it?', 'Menus');
  ok('a sentence holding a whole decision title blocks the decision gate', gate(DECISION_GATE, root, [titleSentence]).code === BLOCK);
  const scattered = question('A new game needs menus. Settings of the harbour are by convention, and screens come later. Defaults stay open.', 'Menus');
  const pooledBlock = gate(DECISION_GATE, root, [{ ...scattered, header: 'Menus', question: 'Should a new game keep default menus? Consider the settings screen. The convention differs for the harbour.' }]);
  ok('the title words spread over separate sentences do not restate a decision', pooledBlock.code === PASS, pooledBlock.out);
  const governed = question(`A new game gets default menus and a settings screen by convention, so which menu does the harbour use? ${TAG('FQD-D054')}`, 'Menus');
  ok('a decision the question names by id is context, never a restatement', gate(DECISION_GATE, root, [question('A new game gets default menus and a settings screen by convention (FQD-D030), so which menu does the harbour use?', 'Menus')]).code === PASS);
  ok('a decision that governs the options, cited in the tag, is context: a near-title sentence still passes only when the run is short', gate(DECISION_GATE, root, [question(`Does the harbour want game menus by convention? ${TAG('FQD-D030')}`, 'Menus')]).code === PASS);
  ok('negative control: the near-verbatim title with a tag still blocks the decision gate', gate(DECISION_GATE, root, [governed]).code === BLOCK);

  const bad = [question('Does FQD-D030 need an override?', 'Bare', [option('Yes', 'one'), option('No', 'two')])];
  const run = await runQuestionGates({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: bad } }, { cwd: root });
  const protocol = JSON.stringify(GATES.question);
  ok('RDG-D145: the question protocol lists no in-question summary check and says the summary lives above the call', !/self-contained|400 characters/.test(protocol) && protocol.includes('RDG-D145') && !QUESTION_GATES.includes('question-self-contained-gate.mjs'));
  ok('every failing check is reported in one run (recommendation and ids)', run.blocks.map((b) => b.gate).join() === 'question-gate,ids-described-gate', run.blocks.map((b) => b.gate).join());
  const shortOk = [question('Which lever goes first?', 'Lever')];
  ok('RDG-D145: a short question with no summary inside passes every gate', gate('question-gates.mjs', root, shortOk).code === PASS);
  const hookRun = gate('question-gates.mjs', root, bad);
  ok('the orchestrator refuses once with every failure, the gate names and the triage line once', hookRun.code === BLOCK
    && /fails 2 checks/.test(hookRun.out) && hookRun.out.includes('== question-gate ==') && hookRun.out.includes('== ids-described-gate ==')
    && hookRun.out.split('BLOCK TRIAGE').length === 2 && hookRun.out.includes('q gates question --draft'));
  ok('every refusal says to repeat the whole summary of at least 40 words directly above a resend (KIT-T1465)', /Resending: repeat the WHOLE plain summary \(at least 40 words/.test(hookRun.out) && /directly above the call/.test(hookRun.out) && /summary above the blocked call is not read/.test(hookRun.out));
  ok('control: a questionnaire that passes every gate carries no resend text', !/Resending:/.test(gate('question-gates.mjs', root, shortOk).out));
  const good = [question(LONG_SUMMARY)];
  ok('a well-formed questionnaire passes the orchestrator', gate('question-gates.mjs', root, good).code === PASS);
  ok('negative control: the orchestrator fails open on a payload with no questions', gate('question-gates.mjs', root, []).code === PASS);

  const draftDir = tmpDir('qgft-draft-');
  const writeDraft = (name, value) => { const file = join(draftDir, name); writeFileSync(file, JSON.stringify(value)); return file; };
  const dry = async (file) => { let out = ''; let err = ''; const code = await runGates(['question', '--draft', file], { root, out: { write: (s) => { out += s; } }, err: { write: (s) => { err += s; } } }); return { code, out, err }; };
  const passing = await dry(writeDraft('ok.json', { summary: LONG_SUMMARY, questions: good }));
  ok('the dry run passes a sound draft with its summary', passing.code === 0 && /PASS/.test(passing.out));
  const failing = await dry(writeDraft('bad.json', { summary: 'Too short.', questions: [...bad, cited] }));
  ok('the dry run lists every failure at once: gates and the short summary', failing.code === 2 && /question-gate/.test(failing.out) && /ids-described-gate/.test(failing.out) && /summary above the call/.test(failing.out) && !/self-contained/.test(failing.out));
  const noSummary = await dry(writeDraft('nosummary.json', good));
  ok('a draft with no summary passes the gates and says the audit judges the summary', noSummary.code === 0 && /no "summary"/.test(noSummary.out));
  ok('the dry run reads a bare questions array', (await dry(writeDraft('array.json', bad))).code === 2);
  ok('an unreadable draft is a usage error, not a pass', (await dry(join(draftDir, 'missing.json'))).code === 1);
  ok('the dry run has no side effect on question files (no session id)', !/asked/.test(failing.out));
} finally {
  cleanup();
}
done();
