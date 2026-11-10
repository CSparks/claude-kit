#!/usr/bin/env node
// dispatch-conformance.test.mjs — the conformance-named dispatch check (KIT-T690).
// Run: node hooks/dispatch-conformance.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFORMANCE_CHECK, conformanceBlock } from './dispatch-conformance.mjs';
import { parseFramework } from './lib/frameworks.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const TEST_NAME = 'framework_conformance';
const declared = [parseFramework(`---\nname: rapid-game\nconformance: ${TEST_NAME}\n---\nbody\n`)];
const undeclared = [parseFramework('---\nname: rapid-game\n---\nbody\n')];
const BRIEF = 'Cut the shadow cost of the scatter chunks: fewer instances per draw call';
const block = (prompt, { type = 'claude-kit:patch-worker', frameworks = declared } = {}) =>
  conformanceBlock({ root: process.cwd(), input: { subagent_type: type }, prompt, footer: `check ${CONFORMANCE_CHECK}`, frameworks });

check('front matter `conformance:` is parsed', declared[0].conformance === TEST_NAME && !undeclared[0].conformance);
check('a rendering brief that never names the test is blocked and names it', /Fix: name framework_conformance/.test(block(BRIEF) || ''));
check('naming the test in the brief passes', block(`${BRIEF}. Acceptance: ${TEST_NAME} passes.`) === null);
check('"not affected" with a reason passes; without one it does not', block(`${BRIEF} [conformance: not affected: gameplay rule only]`) === null
  && block(`${BRIEF} [conformance: not affected]`) !== null);
check('non-rendering work passes', block('Rename the race result enum and update callers') === null);
check('a brief naming the physics module path (src/streaming) passes (KIT-T955); a real streaming brief still blocks',
  block('Make PhysicsWorld deterministic in rapid-game/rust/engine/rg-physics/src/streaming/world.rs') === null
  && block('Make PhysicsWorld deterministic in rg-physics/src/streaming/world.rs and cut the chunk streaming stall') !== null);
check('a framework that declares no conformance test is never asked', block(BRIEF, { frameworks: undeclared }) === null);
check('a read-only researcher is never asked; a generic writer is', block(BRIEF, { type: 'claude-kit:researcher' }) === null
  && block(BRIEF, { type: 'general-purpose' }) !== null);

const tree = (gitmodules) => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-conf-'));
  mkdirSync(join(dir, '.git'));
  if (gitmodules) writeFileSync(join(dir, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  return dir;
};
const game = tree(true);
const kit = tree(false);
const viaTree = (root, declaredTree, prompt = BRIEF) =>
  conformanceBlock({ root, input: { subagent_type: 'claude-kit:patch-worker', prompt: `${prompt} [tree: ${declaredTree}]` }, prompt: `${prompt} [tree: ${declaredTree}]`, footer: `check ${CONFORMANCE_CHECK}` });
try {
  check('a brief whose [tree:] is a checkout with no framework is not asked (KIT-T937)', viaTree(game, kit) === null);
  check('negative control: a [tree:] that is a framework checkout is still asked', viaTree(kit, game) !== null);
  check('negative control: a [tree:] that is not a repo root does not lift the check', viaTree(game, join(kit, 'nowhere')) !== null);
} finally {
  rmSync(game, { recursive: true, force: true });
  rmSync(kit, { recursive: true, force: true });
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
