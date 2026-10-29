#!/usr/bin/env node
// dispatch-conformance.test.mjs — the conformance-named dispatch check (KIT-T690).
// Run: node hooks/dispatch-conformance.test.mjs

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
check('a framework that declares no conformance test is never asked', block(BRIEF, { frameworks: undeclared }) === null);
check('a read-only researcher is never asked; a generic writer is', block(BRIEF, { type: 'claude-kit:researcher' }) === null
  && block(BRIEF, { type: 'general-purpose' }) !== null);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
