#!/usr/bin/env node
// q-miss.test.mjs — a grep after an empty q files a q-gap only when the grep is for the same thing: it shares
// at least half of the smaller term set. A shared common word (`test`, `impl`) is not the same search.
// Run: node hooks/q-miss.test.mjs

import { sameTerms, queryTerms } from './lib/q-miss.mjs';

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

const joined = (qs) => queryTerms(qs).join(' ');
check('flag names and values are not terms', joined('foot --path rapid-game/rust/core/rg-ik --type fn,struct') === 'foot');
check('= form, short flags and redirects are dropped', joined('-i --lang=rust -C 2 foot 2>&1') === 'foot');
check('a boolean flag before the term keeps the term', joined('--regex "ChunkMesh" -l') === 'chunkmesh');
check('a hyphenated term survives', joined('rg-pathfind --type fn') === 'pathfind');
const symQ = queryTerms('foot --path rapid-game/rust/core/rg-ik --type fn,struct');
check('a sym for a name then a public-API listing grep is not a gap', !sameTerms(symQ, 'pub fn\\|pub struct\\|^//!'));
check('the same name then a grep for it is still a gap', sameTerms(symQ, 'foot'));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
