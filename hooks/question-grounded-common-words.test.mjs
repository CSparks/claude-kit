// question-grounded label precision (KIT-T1294): an option label matches a document on its subject, not on common words the
// document happens to hold. A bill-of-work label ('Collect hand-backs only', 'Tree tidy first') matches nothing in a store
// where hand, back, tree and first are everywhere; a label naming a document's subject words, or restating its title, still matches.
// Run: node hooks/question-grounded-common-words.test.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { groundingMatches } from './lib/question-grounding.mjs';

const { ok, done } = reporter('question-grounded-common-words');
const GATE = 'question-grounded-gate.mjs';
const FILLERS = 60;

const ticket = (id, title, text) => ({ id, kind: 'ticket', title, text: `${title}\n${text}` });
const COMMON = 'hand back tree first tidy work files hands trees';
const filler = (n) => ticket(`RDG-T${200 + n}`, `Filler job number ${n}`, `${COMMON} routine notes`);

const CAMERA = ticket('RDG-T033', "The fly probe's camera jerks back and forth", 'the probe teleports; hand over the camera tidy back');
const CHUNKS = ticket('RDG-T072', 'Chunk building is slow and the camera drops in before the first frame', 'tree first');
const TREES = ticket('RDG-T061', 'Trees look like blobs, not photorealistic', 'the plant models tree tidy first');
const FAR = ticket('RDG-T034', 'Far vegetation: forests stay visible to the horizon', 'far trees tidy first');
const docs = [CAMERA, CHUNKS, TREES, FAR, ...Array.from({ length: FILLERS }, (_, n) => filler(n))];
const ids = (label) => groundingMatches(docs, label).map((m) => m.id);

try {
  ok("'Collect hand-backs only' matches no ticket that merely shares hand and back", ids('Collect hand-backs only').length === 0);
  ok("'Tree tidy first' matches no ticket that merely shares tree, tidy and first", ids('Tree tidy first').length === 0);
  ok('a label restating a title still matches it', ids('Chunk building is slow').includes('RDG-T072'));
  ok('a label with two distinctive subject words still matches', ids('Far vegetation forests').includes('RDG-T034'));
  ok('one distinctive word with a common word does not match', ids('Photorealistic first').length === 0);

  const d = adopted(false);
  const tickets = join(d, '.ai', 'tickets');
  mkdirSync(tickets, { recursive: true });
  for (const t of docs) writeFileSync(join(tickets, `${t.id}-x.md`), `---\nid: ${t.id}\ntitle: ${t.title}\ntype: bug\nstatus: todo\n---\n${t.text}\n`);
  const ask = (...labels) => hook(GATE, { tool_name: 'AskUserQuestion', tool_input: { questions: [{ header: 'Bill', question: 'Which bill of work?', options: labels.map((label) => ({ label })) }] } }, d);
  ok('the gate passes the bill-of-work questionnaire', ask('(Recommended) Collect hand-backs only', 'Tree tidy first').code === 0);
  ok('the gate still blocks an option restating a ticket title', ask('Chunk building is slow', 'Leave it').code === 2);
} finally {
  cleanup();
}

done();
