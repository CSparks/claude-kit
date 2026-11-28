// speaker-names-gate (RDG-D177, KIT-T1624): in a project whose store holds the speaker-names decision, a questionnaire whose
// question text, option label or option description uses you, your, yours, I, my, me, we, our or us for the parties is
// refused, naming the word and its sentence; quoted words, code, gate tags, the names and the summary above the call pass.
// Run: node hooks/speaker-names-gate.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, project, reporter, tmpDir } from './test-harness.mjs';
import { gate, option, question } from './question-gates-fixture.mjs';
import { questionGateWired } from './question-gate-wiring.mjs';
import { runGates } from '../scripts/q-gates.mjs';
import { gateText } from './lib/gate-protocol.mjs';
import { speakerHits } from './lib/speaker-names.mjs';

const { ok, done } = reporter('speaker-names-gate');
const GATE = 'speaker-names-gate.mjs';
const BLOCK = 2;
const PASS = 0;
const RULE_TITLE = 'Replies name the speakers, never "you" and "I';

const decision = (id, title) => `---\nid: ${id}\ntitle: ${title}\nsummary: ${title}\ndate: 2026-11-24\nsupersedes: \nsource: \n---\n\n**Decision:** x\n`;
function store(key, files) {
  const root = project('required', key);
  const dir = join(root, '.ai', 'decisions');
  mkdirSync(dir, { recursive: true });
  for (const [file, id, title] of files) writeFileSync(join(dir, file), decision(id, title));
  return root;
}

const NAMED = question('Which order should Claude run the timing in?', 'Order', [
  option('(Recommended) Claude runs it now', 'Chris keeps working; Claude reports the number.'),
  option('Chris runs the installer first', 'Claude waits for the installer.'),
]);
const WORDS = {
  you: 'Should you run the installer?', your: 'Is the timing your pick?', yours: 'Is the pick yours?',
  I: 'Should I run the timing?', my: 'Does my plan hold?', me: 'Should the timing wait for me?',
  we: 'Should we cut the crate?', our: 'Does our plan hold?', us: 'Should the cut wait for us?',
};

try {
  ok('wired into hooks.json for AskUserQuestion (through question-gates)', questionGateWired(GATE));
  ok('q gates question prints the check', /speaker-names/.test(gateText('question', {})) && /"Chris" and "Claude"/.test(gateText('question', {})));

  for (const [word, text] of Object.entries(WORDS)) ok(`matcher flags "${word}"`, speakerHits(text).some((h) => h.word.toLowerCase() === word.toLowerCase()), JSON.stringify(speakerHits(text)));
  ok('matcher flags contractions (I\'ll, you\'re, we\'d)', ['I\'ll run it.', 'Then you\'re done.', 'Then we\'d cut it.'].every((t) => speakerHits(t).length === 1));
  ok('matcher flags a capitalised word at a sentence start', speakerHits('Your pick holds. We cut it. My plan. Us too. Me first. Our crate. You run it.').length === 7);
  const passing = [
    'Chris runs the installer and Claude runs the timing.',
    'Chris wrote "you run it" in the ticket.',
    'Chris said “I will” in the call.',
    'Chris wrote "I will. You do it." and Claude agreed.',
    'Run `you --help` to see it.',
    'Output:\n```\nI ran it\nwe ran it\n```\nDone.',
    '> you said to cut it\n\nClaude cut it.',
    'The US build and the ME region ship.',
    'The I/O thread and us-east-1 hold.',
    'The museum, the menu, myth and youth are words.',
    'Cut it now [re-ask: you asked it last week]',
  ];
  for (const t of passing) ok(`matcher passes: ${t.replace(/\n/g, ' | ')}`, speakerHits(t).length === 0, JSON.stringify(speakerHits(t)));
  const cut = speakerHits('Chris wrote "Stop. Now." and then you ran it. Claude timed it.');
  ok('the sentence is cut from the original text around a quote holding a full stop', cut.length === 1 && cut[0].sentence === 'Chris wrote "Stop. Now." and then you ran it.', JSON.stringify(cut));

  const byId = store('RDG', [['RDG-D177-replies-name-the-speakers.md', 'RDG-D177', 'Pronouns in questionnaires']]);
  const byTitle = store('FQD', [['FQD-D099-speakers.md', 'FQD-D099', RULE_TITLE]]);
  const none = store('NON', [['NON-D001-other.md', 'NON-D001', 'Save files carry a version number']]);

  const asked = question('Should you run the installer?', 'Installer');
  ok('the decision found by its id: blocked', gate(GATE, byId, [asked]).code === BLOCK);
  ok('the decision found by its title: blocked', gate(GATE, byTitle, [asked]).code === BLOCK);
  ok('a store without the decision: the same pronouns pass', gate(GATE, none, [asked]).code === PASS);

  for (const [word, text] of Object.entries(WORDS)) {
    const r = gate(GATE, byId, [question(text, 'Pick')]);
    ok(`gate refuses "${word}" in the question text and names the word and sentence`, r.code === BLOCK && r.out.includes(`"${word}" in the question text`) && r.out.includes(text), r.out);
  }
  const label = gate(GATE, byId, [question('Which order holds?', 'Order', [option('(Recommended) I run it now', 'Claude reports the number.'), option('Chris waits', 'Nothing runs.')])]);
  ok('gate refuses a pronoun in an option label and names the field', label.code === BLOCK && label.out.includes('"I" in the label of option 1 of question 1 (Order)'), label.out);
  const desc = gate(GATE, byId, [question('Which order holds?', 'Order', [option('(Recommended) Claude runs it now', 'Our plan holds.'), option('Chris waits', 'Nothing runs.')])]);
  ok('gate refuses a pronoun in an option description and names the field', desc.code === BLOCK && desc.out.includes('"Our" in the description of option 1 of question 1 (Order)'), desc.out);
  ok('the block says to name "Chris" and "Claude" and names the check id', /"Chris" and "Claude"/.test(desc.out) && desc.out.includes('id: speaker-names') && desc.out.includes('Our plan holds.'), desc.out);

  ok('the names pass', gate(GATE, byId, [NAMED]).code === PASS);
  ok('quoted words and code pass', gate(GATE, byId, [question('Does Chris keep the line "you run it" and `my_crate`?', 'Quote')]).code === PASS);
  ok('the header is not judged', gate(GATE, byId, [{ ...NAMED, header: 'Your pick' }]).code === PASS);

  const draftDir = tmpDir('speaker-draft-');
  const dry = async (draft) => {
    const file = join(draftDir, `draft-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, JSON.stringify(draft));
    let out = '';
    await runGates(['question', '--draft', file], { root: byId, out: { write: (s) => { out += s; } }, err: { write: () => {} } });
    return out;
  };
  const summary = 'I recommend that Claude runs the timing now, because you asked for the number before the installer and we lose nothing by waiting.';
  const fine = await dry({ summary, questions: [NAMED] });
  ok('dry run: a summary that says "I recommend" and "you" draws no speaker-names block', !fine.includes('speaker-names'), fine);
  const bad = await dry({ summary, questions: [question('Should you run the installer?', 'Installer', NAMED.options)] });
  ok('dry run: a pronoun in the question text is refused by the speaker-names gate', bad.includes('== speaker-names-gate ==') && bad.includes('"you" in the question text'), bad);
} finally {
  cleanup();
}
done();
