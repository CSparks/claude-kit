#!/usr/bin/env node
// dispatch-tests.test.mjs — the tests-not-implicit dispatch check (KIT-T1186, KIT-D162, KIT-D163): in a Cargo workspace a
// brief that orders routine test runs is blocked unless it carries a [tests:] reason; a brief that forbids runs, a
// compile-only `--no-run`, and any brief into a repo with no Cargo.toml (the kit) pass. In a repo that uses rapid-game
// the [tests:] reasons no longer pass for a whole suite: only [tests-signoff:] lifts it, while a targeted test (one named
// test or test file) needs no tag (RDG-D065, KIT-T1353).
// Run: node hooks/dispatch-tests.test.mjs

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ignoreFile, expect, finish, makeRepo, run } from './dispatch-guard-harness.mjs';
import { TESTS_CHECK, testRunOrders, wholeSuiteOrders } from './dispatch-tests.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

const rust = makeRepo({ cargo: true });
execFileSync('git', ['add', 'Cargo.toml'], { cwd: rust });
const node = makeRepo();

const send = (dir, prompt) => run(dir, { subagent_type: 'general-purpose', model: 'opus', prompt });
const blocked = (dir, prompt) => { const r = send(dir, prompt); return r.code === 2 && r.err.includes(TESTS_CHECK) ? 2 : r.code; };

const ORDERED = [
  ['re-run the suite', 'After each change re-run the suite.'],
  ['the cargo t alias on a crate', 'Verify with cargo t -p rg-flora.'],
  ['the sentence after a forbidding sentence', 'Do not touch the shaders. Then run the tests.'],
  ['an unscoped cargo test on a crate', 'Step 3: cargo test -p road-generator.'],
  ['all tests in the workspace', 'Then run all tests in the workspace.'],
  ['a whole-suite order beside a named test', 'Run cargo test -p x --test town_walls, then re-run the suite.'],
];
for (const [name, prompt] of ORDERED) expect(`blocks ${name}`, blocked(rust, prompt), 2);

// The owner's tests rule applies to every Cargo repo: a named test or test file needs no tag.
const TARGETED = [
  ['run the test', 'Fix the cut wall. Run the test for the wall when done.'],
  ['run it once', 'Add the measuring step, then run it once.'],
  ['one measuring test per point', 'Per point: cargo check; ONE measuring test per point, once.'],
  ['a test per point', 'Cover each point with a test per point.'],
  ['cargo test on a named test file', 'Step 3: cargo test -p road-generator --test town.'],
  ['a snake_case test name', 'Run cargo test -p rg-noise cut_wall_is_grey once.'],
  ['a name after the double dash', 'Run cargo test -p rg-noise -- walls --nocapture once.'],
  ['the clause after a semicolon beside a negation', 'Do not edit the lib; run the new test once it compiles.'],
  ['N passed as evidence', 'Report "tests: N passed" for each step.'],
  ['a counted pass as evidence', 'Cite 12 passed in your report.'],
];
for (const [name, prompt] of TARGETED) expect(`passes a targeted order without a tag: ${name}`, blocked(rust, prompt), 0);

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

expect('a [tests: none] without cargo check named still blocks a whole-suite order', blocked(rust, 'Re-run the suite once. [tests: none]'), 2);
expect('a bare [tests: troubleshoot] with no fault still blocks a whole-suite order', blocked(rust, 'Re-run the suite once. [tests: troubleshoot]'), 2);
expect('a whole-suite order with a fault named passes', blocked(rust, 'Re-run the suite once. [tests: troubleshoot walls render grey]'), 0);
expect('a whole-suite order with a signoff passes', blocked(rust, 'Re-run the suite once. [tests-signoff: "yes, the suite" - Chris, questionnaire]'), 0);
expect('a brief into the kit (no Cargo.toml) is never judged', blocked(node, 'Run the test once; cargo test is fine; 12 passed.'), 0);
const fromRust = send(rust, `Run the test once; cargo test is fine. [tree: ${node.replace(/\\/g, '/')}]`);
expect('a Cargo session dispatching into the kit checkout via [tree:] is not judged', fromRust.err.includes(TESTS_CHECK) ? 1 : 0, 0);
expect('the same brief with no [tree:] from the Cargo session is judged', send(rust, 'Run the test once; cargo test is fine.').err.includes(TESTS_CHECK) ? 1 : 0, 1);
const refused = send(rust, 'Re-run the suite once.');
expect('the block states the rule, the default and the tag forms', /KIT-D162/.test(refused.err) && /cargo check/.test(refused.err) && /do not run them/.test(refused.err) && /\[tests: periodic batch\]/.test(refused.err) ? 1 : 0, 1);
expect('the block says a targeted test needs no tag and a whole suite needs his approval', /targeted test/.test(refused.err) && /whole suite/.test(refused.err) && /needs no tag/.test(refused.err) ? 1 : 0, 1);
expect('control: a targeted order beside a forbidding clause passes with no block text', send(rust, 'Run cargo test -p x --test town_walls once.').err.includes(TESTS_CHECK) ? 1 : 0, 0);
expect('the ignore file lifts the check', send(ignoreFile(makeRepoCargo(), TESTS_CHECK), 'Re-run the suite once.').code, 0);
expect('the phrase finder names what it found', testRunOrders('Run the test once. Then cargo test -p x.').length, 2);

// RDG-D063: in a repo that uses rapid-game a run order needs [tests-signoff:]; the [tests:] reasons do not pass.
const framework = makeRepoCargo();
writeFileSync(join(framework, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n\turl = ../rapid-game\n');
const SIGNOFF = '[tests-signoff: "yes, run the rg-noise tests" - Chris, questionnaire]';
const FRAMEWORK_BLOCKED = [
  ['cargo test on a framework crate with a troubleshoot tag', 'Run cargo test -p rg-noise. [tests: troubleshoot noise is grey]'],
  ['a periodic batch tag', 'Confirm landed work: cargo test --workspace. [tests: periodic batch]'],
  ['a builds --run cargo test', 'Start builds --run "cargo test -p rg-terrain" --out run.txt. [tests: troubleshoot terrain gaps]'],
  ['run the tests with a troubleshoot tag', 'Run the tests for the skirt. [tests: troubleshoot skirt gap]'],
  ['cargo test with [tests: none] naming cargo check', 'Verify with cargo check, then cargo test -p rg-flora. [tests: none]'],
  ['an empty signoff tag', 'Run cargo test -p rg-noise. [tests-signoff: ]'],
  ['an unscoped cargo test', 'Step 3: cargo test -p road-generator.'],
  ['the whole suite', 'When done re-run the suite for the crate.'],
  ['all tests', 'Then run all tests in the workspace. [tests: troubleshoot walls]'],
  ['a bare cargo test with no crate', 'Verify with cargo test.'],
  ['cargo test with only flags after it', 'Step 3: cargo test --release -p rg-noise -j 2.'],
];
for (const [name, prompt] of FRAMEWORK_BLOCKED) expect(`rapid-game repo blocks ${name}`, blocked(framework, prompt), 2);
const FRAMEWORK_PASSING = [
  ['a signoff on cargo test', `Run cargo test -p rg-noise. ${SIGNOFF}`],
  ['a signoff beside a troubleshoot tag', `Run the test that fails. [tests: troubleshoot noise] ${SIGNOFF}`],
  ['cargo check only', 'Rename the enum variant; verify with cargo check. Write the tests, do not run them.'],
  ['a compile-only test build', 'Compile with cargo test -p rg-noise --no-run only.'],
  ['[tests: none] with no run order', 'Fix the lib. [tests: none] Verify with cargo check.'],
  ['a forbid on cargo test', 'Do not run cargo test; cargo check is the verification.'],
  ['a named test file (RDG-D065)', 'Step 3: cargo test -p road-generator --test mountain_look.'],
  ['a named test file with the test= form', 'Run cargo test -p rg-noise --test=noise_grid once.'],
  ['a snake_case test name', 'Run cargo test -p rg-noise cut_wall_is_grey once.'],
  ['a path test name', 'Run cargo test -p rg-noise town::walls::cut once.'],
  ['a name after the double dash', 'Run cargo test -p rg-noise -- walls --nocapture once.'],
  ['a single test, no crate words', 'Run the test for the wall when done.'],
  ['one measuring test per point', 'Per point: cargo check; ONE measuring test per point, once.'],
  ['a named test inside builds --run', 'Start builds --run "cargo test -p rg-terrain --test skirt_gap" --out run.txt.'],
];
for (const [name, prompt] of FRAMEWORK_PASSING) expect(`rapid-game repo passes ${name}`, blocked(framework, prompt), 0);
expect('control: a Cargo repo without rapid-game still passes a troubleshoot tag', blocked(rust, 'Run cargo test -p rg-noise. [tests: troubleshoot noise is grey]'), 0);
expect('a signoff also passes a Cargo repo without rapid-game', blocked(rust, `Run cargo test -p x. ${SIGNOFF}`), 0);
const signoffRefused = send(framework, 'Run cargo test -p rg-noise. [tests: troubleshoot noise is grey]');
expect('the framework block states the targeted-versus-whole-suite rule, cites RDG-D065 and prints the exact signoff tag form', /RDG-D065/.test(signoffRefused.err) && /targeted test/.test(signoffRefused.err) && /whole suite/.test(signoffRefused.err) && signoffRefused.err.includes(TOKENS.testsSignoff.form) ? 1 : 0, 1);
expect('a whole-suite order beside a named test is still blocked', blocked(framework, 'Run cargo test -p rg-noise --test noise_grid, then re-run the suite.'), 2);
expect('a whole-suite order with a signoff passes', blocked(framework, `Re-run the suite for rg-noise. ${SIGNOFF}`), 0);
expect('the whole-suite finder skips a named test file', wholeSuiteOrders('Run cargo test -p x --test town_walls.').length, 0);
expect('the whole-suite finder names an unscoped crate run', wholeSuiteOrders('Run cargo test -p x.').length, 1);
expect('the whole-suite finder skips a forbidding clause', wholeSuiteOrders('Do not re-run the suite.').length, 0);
expect('a rapid-game session dispatching into the kit checkout via [tree:] is not judged', send(framework, `Run cargo test -p x. [tests: troubleshoot y] [tree: ${node.replace(/\\/g, '/')}]`).err.includes(TESTS_CHECK) ? 1 : 0, 0);
expect('the ignore file lifts the framework check', send(ignoreFile(frameworkRepo(), TESTS_CHECK), 'Run cargo test -p rg-noise.').code, 0);

function frameworkRepo() {
  const dir = makeRepoCargo();
  writeFileSync(join(dir, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  return dir;
}

function makeRepoCargo() {
  const dir = makeRepo({ cargo: true });
  execFileSync('git', ['add', 'Cargo.toml'], { cwd: dir });
  return dir;
}

finish();
