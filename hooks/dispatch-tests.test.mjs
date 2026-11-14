#!/usr/bin/env node
// dispatch-tests.test.mjs — the tests-not-implicit dispatch check (KIT-T1186, KIT-D162, KIT-D163): in a Cargo workspace a
// brief that orders routine test runs is blocked unless it carries a [tests:] reason; a brief that forbids runs, a
// compile-only `--no-run`, and any brief into a repo with no Cargo.toml (the kit) pass.
// Run: node hooks/dispatch-tests.test.mjs

import { execFileSync } from 'node:child_process';
import { ignoreFile, expect, finish, makeRepo, run } from './dispatch-guard-harness.mjs';
import { TESTS_CHECK, testRunOrders } from './dispatch-tests.mjs';

const rust = makeRepo({ cargo: true });
execFileSync('git', ['add', 'Cargo.toml'], { cwd: rust });
const node = makeRepo();

const send = (dir, prompt) => run(dir, { subagent_type: 'general-purpose', model: 'opus', prompt });
const blocked = (dir, prompt) => { const r = send(dir, prompt); return r.code === 2 && r.err.includes(TESTS_CHECK) ? 2 : r.code; };

const ORDERED = [
  ['run the test', 'Fix the cut wall. Run the test for the wall when done.'],
  ['run it once', 'Add the measuring step, then run it once.'],
  ['one measuring test per point', 'Per point: cargo check; ONE measuring test per point, once.'],
  ['a test per point', 'Cover each point with a test per point.'],
  ['re-run the suite', 'After each change re-run the suite.'],
  ['cargo test as a step', 'Step 3: cargo test -p road-generator --test town.'],
  ['the cargo t alias', 'Verify with cargo t -p rg-flora.'],
  ['N passed as evidence', 'Report "tests: N passed" for each step.'],
  ['a counted pass as evidence', 'Cite 12 passed in your report.'],
  ['the sentence after a forbidding sentence', 'Do not touch the shaders. Then run the tests.'],
  ['the clause after a semicolon beside a negation', 'Do not edit the lib; run the new test once it compiles.'],
];
for (const [name, prompt] of ORDERED) expect(`blocks ${name}`, blocked(rust, prompt), 2);

const PASSING = [
  ['write the test, do not run it', 'Write the test for the wall; do not run it. Verify with cargo check.'],
  ['a forbid on cargo test', 'Do not run cargo test or any suite; cargo check is the verification.'],
  ['never running tests', 'Never run tests: the coordinator batches them.'],
  ['a compile-only test build', 'Compile the tests with cargo test -p rg-flora --no-run only.'],
  ['no test words', 'Rename the enum variant and update the callers; verify with cargo check.'],
  ['a troubleshoot tag', 'Run the test that fails. [tests: troubleshoot cut walls render grey]'],
  ['the periodic batch tag', 'Read-only verification: cargo test -p road-generator. [tests: periodic batch]'],
  ['none naming cargo check', 'Fix the lib, no run. [tests: none] Verify with cargo check.'],
];
for (const [name, prompt] of PASSING) expect(`passes ${name}`, blocked(rust, prompt), 0);

expect('a [tests: none] without cargo check named still blocks a run order', blocked(rust, 'Run the test once. [tests: none]'), 2);
expect('a bare [tests: troubleshoot] with no fault still blocks', blocked(rust, 'Run the test once. [tests: troubleshoot]'), 2);
expect('a brief into the kit (no Cargo.toml) is never judged', blocked(node, 'Run the test once; cargo test is fine; 12 passed.'), 0);
const fromRust = send(rust, `Run the test once; cargo test is fine. [tree: ${node.replace(/\\/g, '/')}]`);
expect('a Cargo session dispatching into the kit checkout via [tree:] is not judged', fromRust.err.includes(TESTS_CHECK) ? 1 : 0, 0);
expect('the same brief with no [tree:] from the Cargo session is judged', send(rust, 'Run the test once; cargo test is fine.').err.includes(TESTS_CHECK) ? 1 : 0, 1);
const refused = send(rust, 'Run the test once.');
expect('the block states the rule, the default and the tag forms', /KIT-D162/.test(refused.err) && /cargo check/.test(refused.err) && /do not run them/.test(refused.err) && /\[tests: periodic batch\]/.test(refused.err) ? 1 : 0, 1);
expect('the ignore file lifts the check', send(ignoreFile(makeRepoCargo(), TESTS_CHECK), 'Run the test once.').code, 0);
expect('the phrase finder names what it found', testRunOrders('Run the test once. Then cargo test -p x.').length, 2);

function makeRepoCargo() {
  const dir = makeRepo({ cargo: true });
  execFileSync('git', ['add', 'Cargo.toml'], { cwd: dir });
  return dir;
}

finish();
