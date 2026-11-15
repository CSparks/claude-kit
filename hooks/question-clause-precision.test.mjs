// question-clause precision (KIT-T1227): the clause matcher weights each stem by rarity over the store's decision clauses and
// blocks only a clause that shares a rare stem and enough weight. Unrelated decisions that share common stems with a
// questionnaire pass; a true restatement (GG-D080 clause 2, GG-D068) blocks and the block names the rare stems.
// Run: node hooks/question-clause-precision.test.mjs

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENV, ROOT, adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { clauseMatches, clauseMisses, indexClauses } from './lib/question-clause-grounding.mjs';
import { GROUNDED_CLAUSE_SCORE } from './lib/question-checks.mjs';

const { ok, done } = reporter('question-clause-precision');
const GATE = 'question-grounded-gate.mjs';
const FILLERS = 40;
const COMMON_STEMS = 6;

const decision = (id, title, ...clauses) => ({ id, kind: 'decision', title, text: `**Decision:** ${clauses.map((c, i) => `(${i + 1}) ${c}`).join(' ')}\n\n**Why:** none` });
const filler = (n) => decision(`GG-D${900 + n}`, `Filler ${n}`, 'The Song scene track setting of each project group pads role follows the plan.');

const D080 = decision('GG-D080', 'Song mode generation layers: Song settings drive Scene settings',
  'Three layers, strictly ordered.',
  "Event data is a pure function of its scene's settings plus the scene seed; a scene render reads no Song setting (the plan and render split already ruled).",
  'The Song-to-Scene step is the plan stage.');
const D068 = decision('GG-D068', 'Song-mode scene metadata is inert, stored in the scene',
  'Song level holds only the parameters that drive what gets populated at scene level.',
  'Key, scale and tempo are scene metadata; Scene mode and playback ignore the stored values except engine-read attributes such as swing.');
const FALSE_HITS = [
  decision('GG-D032', 'Release model', 'The founder purchase unlocks perks for every project, group licence and song pack.'),
  decision('GG-D073', 'Song mode design rulings', 'Roles derive from tracks: every track has a role; the Roles modal lists each project track.'),
  decision('GG-D104', 'Gauntlet round 1 rulings', 'The bass lag behind the kick is a per scene setting in ticks, drivable from the Song settings.'),
  decision('GG-D106', 'Gauntlet round 2 rulings', 'Old projects keep stored track pitch settings; there is no migration.'),
  decision('GG-D091', 'The song generator chooses sounds from sample folders', 'Sound choice from sample folders is a separate layer; the song generator picks pads for a group.'),
];
const docs = [D080, D068, ...FALSE_HITS, ...Array.from({ length: FILLERS }, (_, n) => filler(n))];

const KIT_QUESTIONS = [
  'Where should a kit live: saved with the project, per Group pads, or in the Song settings of each track?',
  'Should the Group mix of a kit keep one track setting per pads row across the project and the Song?',
  'Which machines become kits: the pads of a Group, or any Song track with a role setting in the project?',
];
const REPLAY_D080 = 'Should a scene render read any Song setting, or only the settings stored in its scene?';
const REPLAY_D068 = 'Should key, scale and tempo be scene metadata, with Scene mode and playback ignoring the stored values?';

try {
  const hitsOf = (text) => clauseMatches(docs, text).map((m) => m.id);
  const falseIds = FALSE_HITS.map((d) => d.id);
  ok('the five unrelated decisions are never matched by a kit questionnaire sharing their common stems',
    KIT_QUESTIONS.every((q) => !hitsOf(q).some((id) => falseIds.includes(id))));
  ok('the common stems are common in the fixture store (the false hits are what the rule must hold back)', (() => {
    const ix = indexClauses(docs);
    return ['song', 'project', 'group', 'sett'].every((s) => !ix.isRare(s));
  })());
  ok('GG-D080 clause 2 restated blocks, with the clause, the rare stems and a score at the threshold or above', (() => {
    const m = clauseMatches(docs, REPLAY_D080).find((x) => x.id === 'GG-D080');
    return m && m.clause.includes('a scene render reads no Song setting') && m.rare.includes('render') && m.rare.includes('read') && m.score >= GROUNDED_CLAUSE_SCORE;
  })());
  ok('GG-D068 restated blocks', hitsOf(REPLAY_D068).includes('GG-D068'));
  ok('a cited restatement passes: clauseMisses names it uncited and drops it cited', clauseMisses(docs, [{ question: REPLAY_D080 }], 'nothing').some((m) => m.id === 'GG-D080')
    && clauseMisses(docs, [{ question: REPLAY_D080 }], 'ruled in GG-D080').every((m) => m.id !== 'GG-D080'));

  const commons = ['song', 'scene', 'track', 'setting', 'project', 'group'];
  ok('negative control: a text of only common stems never matches, however many it shares', commons.length === COMMON_STEMS
    && clauseMatches(docs, 'The song scene track setting project group.').length === 0);

  const d = adopted(false);
  const dir = join(d, '.ai', 'decisions');
  mkdirSync(dir, { recursive: true });
  for (const x of docs) writeFileSync(join(dir, `${x.id}-x.md`), `---\nid: ${x.id}\ntitle: ${x.title}\ndate: 2026-11-14\n---\n${x.text}\n`);
  const ask = (question) => hook(GATE, { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question, header: 'Kit', options: [{ label: '(Recommended) Yes' }, { label: 'No' }] }] } }, d);
  ok('the gate passes every kit questionnaire the five unrelated decisions share stems with', KIT_QUESTIONS.every((q) => ask(q).code === 0));
  const blocked = ask(REPLAY_D080);
  ok('the gate blocks the GG-D080 restatement and the block names the id, the clause, the rare stems and the score',
    blocked.code === 2 && blocked.out.includes('GG-D080 (decision)') && blocked.out.includes('a scene render reads no Song setting') && /matched rare words: [a-z, ]*render/.test(blocked.out) && /score \d/.test(blocked.out));
  ok('the gate passes the same restatement once GG-D080 is cited', ask(`${REPLAY_D080} GG-D080 (generation layers) rules it.`).code === 0);
  const dry = spawnSync(process.execPath, [join(ROOT, 'scripts', 'q.mjs'), 'gates', 'question', '--check-text', REPLAY_D080, '--root', d], { cwd: d, encoding: 'utf8', env: ENV });
  ok('--check-text prints the matched decision with its score, the block threshold and the rare stems', dry.stdout.includes('GG-D080')
    && /score \d/.test(dry.stdout) && dry.stdout.includes(`gate blocks at ${GROUNDED_CLAUSE_SCORE}`) && /rare stems: [a-z, ]*render/.test(dry.stdout));
} finally {
  cleanup();
}

done();
