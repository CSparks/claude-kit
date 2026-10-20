#!/usr/bin/env node
// q-miss.test.mjs — a grep after an empty q files a q-gap only when the grep is for the same thing: it shares
// at least half of the smaller term set. A shared common word (`test`, `impl`) is not the same search.
// Run: node hooks/q-miss.test.mjs

import { sameTerms } from './lib/q-miss.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};
const terms = (s) => [...new Set(s.toLowerCase().split(/[^a-z0-9_]+/).filter((w) => w.length >= 3))];

check('the same word searched again is a gap', sameTerms(terms('events: --path .ai/config.yml'), 'events:'));
check('two of three terms shared is a gap', sameTerms(terms('**/rg-pathfind/**/*.rs'), 'rg-rng\\|rg-pathfind'));
check('one shared common word out of nine is not', !sameTerms(terms('flake pin.test control.test model-tag --project claude-kit'), '^BUDGET|left:|test result'));
check('a different type name sharing only `impl` is not', !sameTerms(terms('Rng --type impl'), 'impl IntoMesh\\|trait IntoMesh'));
check('no shared term is not', !sameTerms(terms('alpha beta'), 'gamma'));
check('an empty search is not', !sameTerms(terms('alpha'), ''));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
