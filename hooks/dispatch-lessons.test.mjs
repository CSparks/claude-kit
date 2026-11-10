#!/usr/bin/env node
// dispatch-lessons.test.mjs — the lessons-checked dispatch check and the orient lessons block (KIT-T690).
// Run: node hooks/dispatch-lessons.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LESSONS_CHECK, lessonsBlock, lessonsWork } from './dispatch-lessons.mjs';
import { frameworkSection } from './lib/frameworks.mjs';
import { lessonHeadings, lessonIds } from './lib/lessons.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const LEDGER = [
  '# Lessons ledger', '', '## 1. Rendering', '',
  '### L-R01 Entity and instance count is CPU cost [M+I]', 'body', '',
  '### L-R02 Merge static pieces per cell [M+I in Stiletto; in progress]', 'body', '',
  '## 3. Streaming and startup', '',
  '### L-S01 No generation on the frame thread [M+I]', 'body', '',
  '## 4. Build structure', '',
  '### L-B01 Split a game into by-concern crates early [A]', 'body', '',
].join('\n');

function game({ ledger = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-lessons-'));
  writeFileSync(join(dir, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  mkdirSync(join(dir, 'rapid-game', 'docs'), { recursive: true });
  if (ledger) writeFileSync(join(dir, 'rapid-game', 'docs', 'LESSONS.md'), LEDGER);
  return dir;
}

const withLedger = game();
const noLedger = game({ ledger: false });
const block = (root, prompt, type = 'claude-kit:patch-worker') => lessonsBlock({ root, input: { subagent_type: type, prompt }, prompt, footer: `check ${LESSONS_CHECK}` });
const checkout = () => { const dir = mkdtempSync(join(tmpdir(), 'kit-tree-')); mkdirSync(join(dir, '.git')); return dir; };
const BRIEF = 'Cut the shadow cost of the scatter chunks: fewer instances per draw call';

try {
  check('lessonIds finds the lesson ids; headings drop the status tags', lessonIds(join(withLedger, 'rapid-game', 'docs', 'LESSONS.md')).size === 4
    && lessonHeadings(join(withLedger, 'rapid-game', 'docs', 'LESSONS.md')).includes('L-R02 Merge static pieces per cell'));
  const section = frameworkSection(withLedger);
  check('orient prints the framework lessons headings after the contract', /FRAMEWORK LESSONS: rapid-game/.test(section) && /\n  L-S01 No generation on the frame thread/.test(section));
  check('no ledger file: no lessons block', !/FRAMEWORK LESSONS/.test(frameworkSection(noLedger)));

  check('a rendering brief with no citation is blocked and names the escape', /lessons-checked: L-R01/.test(block(withLedger, BRIEF)));
  check('a valid ledger id passes', block(withLedger, `${BRIEF} [lessons-checked: L-R01, L-R02]`) === null);
  check('an id the ledger does not define does not count', block(withLedger, `${BRIEF} [lessons-checked: L-Z99]`) !== null);
  check('"none apply" with a reason passes; without one it does not', block(withLedger, `${BRIEF} [lessons-checked: none apply: new gameplay rule]`) === null
    && block(withLedger, `${BRIEF} [lessons-checked: none apply]`) !== null);
  check('non-rendering work passes', block(withLedger, 'Rename the race result enum and update callers') === null);
  check('a repo without a ledger passes', block(noLedger, BRIEF) === null);
  check('a read-only researcher is never asked', block(withLedger, BRIEF, 'claude-kit:researcher') === null);
  check('a generic writer is asked', block(withLedger, BRIEF, 'general-purpose') !== null);
  const kitTree = checkout();
  const otherGame = game();
  mkdirSync(join(otherGame, '.git'));
  try {
    check('a brief whose [tree:] is a checkout with no framework is not asked (KIT-T937)', block(withLedger, `${BRIEF} [tree: ${kitTree}]`) === null);
    check('negative control: a [tree:] that is a framework checkout is still asked', block(withLedger, `${BRIEF} [tree: ${otherGame}]`) !== null);
    check('negative control: a [tree:] that is not a repo root does not lift the check', block(withLedger, `${BRIEF} [tree: ${join(kitTree, 'nowhere')}]`) !== null);
    check('negative control: the same brief with no [tree:] is still asked', block(withLedger, BRIEF) !== null);
  } finally {
    rmSync(kitTree, { recursive: true, force: true });
    rmSync(otherGame, { recursive: true, force: true });
  }
  const PHYSICS = 'Make PhysicsWorld deterministic in rapid-game/rust/engine/rg-physics/src/streaming/world.rs and rapid-game\\rust\\engine\\rg-physics\\src\\streaming\\**';
  check('a brief naming the physics module path (src/streaming) is not rendering work (KIT-T955)', !lessonsWork(PHYSICS) && block(withLedger, PHYSICS) === null);
  check('negative control: a real streaming brief that also names a src path still blocks', lessonsWork(`${PHYSICS}. Cut the chunk streaming stall in the render path`) && block(withLedger, `${PHYSICS}. Cut the chunk streaming stall in the render path`) !== null);
  check('negative control: the bare word streaming outside a crate path still counts', lessonsWork('streaming stalls on reveal') && lessonsWork('crates/rg-assets/streaming stall'));
  check('lessonsWork matches the four themes', ['shader cost', 'texture bake', 'chunk streaming', 'frame time'].every(lessonsWork) && !lessonsWork('fix the menu label'));
} finally {
  rmSync(withLedger, { recursive: true, force: true });
  rmSync(noLedger, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
