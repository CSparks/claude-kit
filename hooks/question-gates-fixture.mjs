// Shared by the questionnaire first-try tests (KIT-T1451): a project store with decisions that pull the questionnaire gates in
// each direction, and the helpers that put a questionnaire through one gate or through every gate at once.
//
//   storeWithDecisions() -> project root     decisions FQD-D010 (a test-run rule), D020 (replaced) and D021 (its replacement),
//                                            D030 (default menus), D040 (pop-in) and filler decisions on unrelated subjects
//   question(text, options?) -> a question   a well-formed question: recommended option first, labels and descriptions
//   gate(script, root, questions) -> { code, out }   one gate script on a payload
//   LONG_SUMMARY                             a 400+ character summary spread over sentences that each touch a different decision loosely

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hook, project } from './test-harness.mjs';

const DECISION = (id, title, decided) => `---\nid: ${id}\ntitle: ${title}\nsummary: ${title}\ndate: 2026-11-01\nsupersedes: \nsource: \n---\n\n**Decision:** ${decided}\n`;

const DECISIONS = [
  ['FQD-D010-test-runs.md', 'FQD-D010', "Every framework test run needs the maintainer's sign-off before it starts",
    "(1) A test run on the framework, a single crate or the whole suite, requires the maintainer's sign-off before it starts; no agent runs cargo test on its own judgement. (2) Agents verify with cargo check and write their tests without running them, and the coordinator batches the approved runs on a quiet machine."],
  ['FQD-D020-patched-allocator.md', 'FQD-D020', 'The framework carries a patched allocator for the pooled upload path',
    'The framework carries a patched allocator so the pooled upload path can exist now.'],
  ['FQD-D021-unpatched-allocator.md', 'FQD-D021', 'The allocator stays unpatched and the pooled upload path uses the public surface (supersedes FQD-D020)',
    'The framework carries no patched allocator. The pooled upload path is built on the public surface of the allocator.'],
  ['FQD-D030-default-menus.md', 'FQD-D030', 'A new game gets default menus and a settings screen by convention',
    'A new game starts with a main menu, a pause menu and a settings screen by default. Everything at menu level can be overridden.'],
  ['FQD-D031-cached-output.md', 'FQD-D031', 'What is generated deterministically is cached: every cooked output is stored by its fingerprint and read back, never regenerated',
    'Every deterministic generated output is cacheable and is cached: a cooked chunk stage, the road network, a settlement plan. Each is stored on disk under a key that names everything its cook reads (seed, world documents, the code that cooks it) and is read back in place of regenerating it. The cache is the framework\'s, one home, used by every game.'],
  ['FQD-D040-pop-in.md', 'FQD-D040', 'Pop-in is hidden on every streamed system',
    'Hiding pop-in is a standing requirement on every streamed system: level-of-detail changes are cross-faded and never pop.'],
  ['FQD-D050-audio.md', 'FQD-D050', 'Engine sounds are synthesised from the vehicle model, never sampled',
    'Engine sounds come from a synthesis model driven by revolutions and load; recorded samples are not used.'],
  ['FQD-D051-saves.md', 'FQD-D051', 'Save files carry a version number and migrate forward on load',
    'Every save file stores a schema version; loading an older file runs the migrations in order.'],
  ['FQD-D052-camera.md', 'FQD-D052', 'The chase camera eases toward the target with a spring, never snapping',
    'The chase camera follows its target with a critically damped spring; a cut only happens at a teleport.'],
  ['FQD-D053-terrain.md', 'FQD-D053', 'Terrain chunks stream in rings around the viewer with hysteresis',
    'Terrain chunks load in concentric rings around the viewer; a ring unloads only after the viewer leaves it by a margin.'],
  ['FQD-D054-input.md', 'FQD-D054', 'Every key read goes through an input context so menus can swallow keys',
    'Keyboard reads go through a context stack; an open menu context swallows the keys it uses.'],
];

export function storeWithDecisions() {
  const root = project('required', 'FQD');
  const dir = join(root, '.ai', 'decisions');
  mkdirSync(dir, { recursive: true });
  for (const [file, id, title, decided] of DECISIONS) writeFileSync(join(dir, file), DECISION(id, title, decided));
  return root;
}

export const option = (label, description) => ({ label, description });

export const question = (text, header = 'Choice', options = [option('(Recommended) Do it now', 'builds on the current approach'), option('Defer it', 'leaves the current approach as it is')]) => ({
  header, question: text, multiSelect: false, options,
});

export const gate = (script, root, questions, extra = {}) => hook(script, { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions }, ...extra }, root);

export const LONG_SUMMARY = [
  'Which approach should the new streaming overlay take for the harbour scene?',
  'The overlay draws buses and boats from one shared pool, and a pool of that size costs about 40 MB per hundred vehicles.',
  'Option A keeps every vehicle drawn at full detail and costs roughly 3 ms per frame on the reference laptop.',
  'Option B swaps distant vehicles for flat impostors, which saves 2 ms per frame and looks flatter beyond 200 m.',
  'The maintainer asked earlier for a calm look in the harbour; neither option changes the weather or the light.',
  'I recommend Option B because the saved milliseconds pay for the sharper water the harbour needs.',
].join(' ');
