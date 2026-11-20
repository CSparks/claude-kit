// question-grounded generic words (KIT-T1431): a questionnaire never matches a decision on generic engineering words (check,
// run, work, time, usage, parallel, agent, test ...). The real case: a question about lifting the one-writer usage limit was
// blocked by six unrelated decisions (RDG-D121, D123, D032, D060, D124, D063) and never by the two that govern it (RDG-D052,
// RDG-D137). A restatement needs three distinct rare words and a shared run of words (KIT-T1451); an `[options-checked: <ids>
// govern this; no other recorded decision applies]` tag raises the bar to a near-verbatim restatement; the block prints the matched words.
// Run: node hooks/question-grounded-generic-words.test.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { optionStems } from './lib/question-grounding.mjs';
import { clauseMatches } from './lib/question-clause-grounding.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

const { ok, done } = reporter('question-grounded-generic-words');
const GATE = 'question-grounded-gate.mjs';
const FILLERS = 40;

const decision = (id, title, text) => ({ id, kind: 'decision', title, text: `**Decision:** ${text}\n\n**Why:** none` });
const D052 = decision('RDG-D052', 'Writing agents are not limited by count, several may write in one checkout',
  "The number of agents writing in a checkout is not limited as such. Several writers work in the one checkout at the same time. The only thing that keeps two writers apart is a write that would break the other's build: two agents do not edit the same files, or files the other's build depends on, at the same time.");
const D137 = decision('RDG-D137', 'Usage is conserved: one writer at a time, sonnet for medium work',
  '(1) Agents already in flight finish their current item. (2) After that one writer runs at a time. (3) Opus is for very hard work only (KIT-D169 to D171 difficulty tiers); medium work goes to Sonnet, automation to Haiku. (4) A blind critic runs only on a round that changed geometry or look, not on test-only or data-only rounds.');
const NEGATIVES = [
  decision('RDG-D121', 'A full Rust best-practices sweep with several agents and no builds',
    '(1) A full sweep of the Rust best practices across the framework crates: every warning of the hot-loop lints is fixed with behaviour unchanged. Several agents sweep disjoint crate groups in parallel. Nobody builds, checks or tests while the sweep runs: agents find sites by reading and searching, not by compiling; one verification build follows when every agent is done. (2) Immediately after the sweep, an agent works on performance tuning until 03:00 central time or until the usage is exhausted, whichever comes first, with measured numbers on a quiet machine. Test runs still need his sign-off.'),
  decision('RDG-D123', 'After a sweep or audit, running every test for what it touched is allowed',
    'When a wide sweep or audit has finished, one full run of the tests for everything it touched is allowed at its end, without a separate sign-off. Outside such an audit single named tests to verify a fix are always allowed, and a full-suite run is the maintainer\'s call. A full run is a single deliberate run, not per commit, not implicit, and the coordinator runs it (one at a time, output to a file).'),
  decision('RDG-D032', 'While Chris is away work does not stop',
    'Until Chris announces his return, the session does not stop working. It works through the open flyover, texture, optimization and world generation tickets one writer at a time in the road-generator checkout, with read-only design and research running alongside. A question only he can answer does not stop the work: it is recorded, and the work moves to the next item that does not depend on it.'),
  decision('RDG-D060', 'Performance measurements run only on a quiet machine',
    "Before any benchmark or performance check, the session makes sure no tests are running and nothing is building, and checks the machine's CPU utilization. A measurement is taken only when the machine is quiet, and it records the utilization it was taken under."),
  decision('RDG-D124', 'Compartmentalised tests, broker limits that can be overridden',
    "(1) The broker's per-run time limit can be overridden for a run known to take long. (2) The test strategy becomes compartmentalised: small isolated tests per asset and per crate, each runnable alone by name, instead of whole suites; a full run stays the exception. (3) That strategy runs against all assets now, one asset or group at a time in a rotation so the machine and the usage are not flooded."),
  decision('RDG-D063', 'Every framework test run requires the maintainer sign-off',
    "From now on a test run on the framework requires the maintainer's sign-off before it starts. No agent and no coordinator runs cargo test on a framework crate on its own judgement: not per step, not per point, not once to measure. Agents verify their work with cargo check and write their tests without running them."),
];
const filler = (n) => decision(`RDG-D${900 + n}`, `Filler ${n}`, `Routine ruling ${n} about the checking of the work and the time of each run in the usage of the agents.`);
const DOCS = [D052, D137, ...NEGATIVES, ...Array.from({ length: FILLERS }, (_, n) => filler(n))];
const NEGATIVE_IDS = NEGATIVES.map((d) => d.id);

const BLOCKED_QUESTION = 'Usage is lower now. Should several writer agents work in parallel again, or keep one writer at a time? Each point is checked once, tests run only after sign-off, and the open work fixes on the road go on.';
const GOVERNED_QUESTION = 'Several writers may work in the one checkout at the same time: the only thing that keeps two writers apart is a write that would break the other\'s build. After that one writer runs at a time, and medium work goes to Sonnet while Opus is for very hard work only.';
const PLAIN = [{ label: '(Recommended) Lift it' }, { label: 'Keep it' }];

try {
  ok('generic engineering stems are dropped from a stem set', optionStems('check runs working times usage once parallel agents points fixes tests performance').size === 0);
  ok('a subject word survives the stop list', optionStems('writer checkout sonnet').size === 3);

  const ids = (text) => clauseMatches(DOCS, text).map((m) => m.id);
  ok('the one-writer usage question matches none of the six unrelated decisions', !ids(BLOCKED_QUESTION).some((id) => NEGATIVE_IDS.includes(id)));
  ok('a question restating the writer and model rulings is matched with RDG-D052 and RDG-D137 as context', ['RDG-D052', 'RDG-D137'].every((id) => ids(GOVERNED_QUESTION).includes(id))
    && !ids(GOVERNED_QUESTION).some((id) => NEGATIVE_IDS.includes(id)));
  ok('a match needs three distinct rare words', clauseMatches(DOCS, GOVERNED_QUESTION).every((m) => m.rare.length >= 3));

  const d = adopted(false);
  const dir = join(d, '.ai', 'decisions');
  mkdirSync(dir, { recursive: true });
  for (const doc of DOCS) writeFileSync(join(dir, `${doc.id}-x.md`), `---\nid: ${doc.id}\ntitle: ${doc.title}\n---\n${doc.text}\n`);
  const ask = (question) => hook(GATE, { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question, header: 'Writers', options: PLAIN }] } }, d);

  ok('the blocked question of 2026-11-19 passes the gate', ask(BLOCKED_QUESTION).code === 0);
  const governed = ask(GOVERNED_QUESTION);
  ok('the gate suggests RDG-D052 and RDG-D137, names the matched words, and never names the six unrelated ones',
    governed.code === 2 && governed.out.includes('RDG-D052') && governed.out.includes('RDG-D137') && governed.out.includes('matched words:')
    && !NEGATIVE_IDS.some((id) => governed.out.includes(id)));
  ok('citing both ids passes', ask(`${GOVERNED_QUESTION} They are RDG-D052 and RDG-D137.`).code === 0);

  const RESTATES_D063 = "Should a test run on the framework require the maintainer's sign-off before it starts, with no agent running cargo test on a framework crate on its own judgement?";
  const control = ask(RESTATES_D063);
  ok('control: a question restating RDG-D063 still blocks, with its matched words', control.code === 2 && control.out.includes('RDG-D063') && control.out.includes('matched words:'));
  ok('control: citing the decision passes', ask(`${RESTATES_D063} It is RDG-D063.`).code === 0);

  const tag = (ids) => `[options-checked: ${ids} govern this; no other recorded decision applies]`;
  ok('the ids tag form satisfies its own pattern', TOKENS.optionsCheckedIds.pattern.test(TOKENS.optionsCheckedIds.form));
  ok('a tag that cites no id is not the ids tag', !TOKENS.optionsCheckedIds.pattern.test('[options-checked: the others matched loosely]'));
  const LOOSE = 'Medium work goes to Sonnet and the hard work for Opus: should that change?';
  ok('a loose match of RDG-D137 blocks untagged', ask(LOOSE).code === 2 && ask(LOOSE).out.includes('RDG-D137'));
  ok('with the ids tag the same loose match of an uncited decision passes', ask(`${LOOSE} ${tag('RDG-D052')}`).code === 0);
  const verbatim = `${D063Clause()} ${tag('RDG-D052')}`;
  ok('with the ids tag a near-verbatim restatement of an uncited decision still blocks', ask(verbatim).code === 2 && ask(verbatim).out.includes('RDG-D063'));
  ok('the none-apply tag still passes a restating question', ask(`${RESTATES_D063} [options-checked: none apply: it asks about a different run]`).code === 0);
} finally {
  cleanup();
}

function D063Clause() {
  return NEGATIVES.find((x) => x.id === 'RDG-D063').text.replace(/^\*\*Decision:\*\*\s*/, '').split('\n')[0];
}

done();
