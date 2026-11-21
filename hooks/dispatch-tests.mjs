// tests-not-implicit — a dispatch check for dispatch-guard (KIT-T1186, KIT-D162, KIT-D163). Rust builds are slow and
// projects share one machine, so a brief into a Cargo workspace never orders test runs as a routine step: "run the
// test", "one measuring test per point", "re-run the suite", `cargo test` as a step, "N passed" as evidence. Default
// verification is `cargo check`; agents write tests and do not run them; the coordinator batches runs on a quiet machine.
// A brief that orders a whole suite says why with `[tests: troubleshoot <fault>]`, `[tests: periodic batch]`, or
// `[tests: none]` naming `cargo check`; a targeted test (one named test or test file) needs no tag, in any Cargo repo.
// A clause that forbids a run ("write the test, do not run it") is the rule itself.
// The Cargo test is `git ls-files` of the dispatch target: a Node repo, including the kit, has none and is never judged.
// In a repo that uses rapid-game those reasons no longer pass for a whole suite (RDG-D065): a targeted test (one named
// test or test file) needs no tag; an ordered whole suite needs
// `[tests-signoff: <his quoted words or the questionnaire answer>]`; `--no-run`, a forbidding clause or no order passes.
//
//   testRunOrders(prompt)                      -> the ordered-run phrases found, [] when none
//   wholeSuiteOrders(prompt)                   -> the ordered whole-suite phrases found, [] when none or all targeted
//   testsBlock({ root, input, prompt, footer }) -> block message | null (check `tests-not-implicit`)

import { hasTrackedCargo } from '../scripts/broker/cargo-scope.mjs';
import { dispatchTargetRoot } from './dispatch-target.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';
import { frameworksFor } from './lib/frameworks.mjs';

export const TESTS_CHECK = 'tests-not-implicit';
const FRAMEWORK_NAME = 'rapid-game';

const CARGO_CHECK = /\bcargo(?:\.exe)?\s+check\b/i;
const NEGATION = /\b(?:never|don'?t|do not|must not|not|no|without|avoid|skip|forbidden|instead of)\b/i;
const NEGATION_REACH = 60;
const CLAUSE_END = /[.;\n]/;
const NO_RUN_REACH = 80;

const RUN_WORDS = String.raw`(?:run|re-?run|execute|launch|start)`;
const ORDERS = [
  /\bcargo(?:\.exe)?\s+(?:test|t|nextest)\b/gi,
  new RegExp(String.raw`\b${RUN_WORDS}\s+(?:the|each|every|that|your|a|one|all|these|those)\s+(?:[\w'-]+\s+){0,2}(?:tests?|suites?)\b`, 'gi'),
  new RegExp(String.raw`\b${RUN_WORDS}\s+it\s+once\b`, 'gi'),
  /\b(?:one|a|1)\s+(?:measuring\s+|measure\s+|regression\s+|targeted\s+)?tests?\s+(?:per|for each|at each|every)\b/gi,
  /\bmeasuring\s+tests?\b/gi,
  /\b(?:N|\d+)\s+(?:tests?\s+)?passed\b/g,
  /\b[Tt]ests?:\s*(?:N|\d+)\b/g,
];

function negated(text, index) {
  const clauseStart = text.slice(0, index).split(CLAUSE_END).pop();
  return NEGATION.test(clauseStart.slice(-NEGATION_REACH));
}

function compileOnly(text, index, length) {
  const rest = text.slice(index + length);
  return /--no-run\b/.test(rest.slice(0, NO_RUN_REACH).split('\n')[0]);
}

export function testRunOrders(prompt) {
  const text = String(prompt || '');
  const found = [];
  for (const re of ORDERS) {
    for (const m of text.matchAll(re)) {
      if (negated(text, m.index) || compileOnly(text, m.index, m[0].length)) continue;
      found.push(m[0].trim());
    }
  }
  return [...new Set(found.map((s) => s.toLowerCase()))];
}

const CARGO_TEST_REST = /\bcargo(?:\.exe)?\s+(?:test|t|nextest)\b((?:[^"'`;|&\n.]|\.(?!\s|$))*)/gi;
const CARGO_VALUE_FLAGS = new Set(['-p', '--package', '--features', '-F', '-j', '--jobs', '--target', '--target-dir', '--manifest-path', '--profile', '--exclude']);
const TEST_NAME = /^(?:\w*_\w*|\w+::[\w:]+)$/;
const WHOLE_SUITE_WORDS = [
  new RegExp(String.raw`\b${RUN_WORDS}\s+(?:the|each|every|all|these|those)?\s*(?:[\w'-]+\s+){0,2}(?:suites?|tests)\b`, 'gi'),
  /\b(?:whole|full|entire|all)\s+(?:the\s+)?(?:test\s+)?(?:suites?|tests)\b/gi,
  /--workspace\b/g,
];

// A `cargo test` names one test or test file when it carries `--test <file>`, a name after `--`, or a snake_case or path name.
function selectsOneTest(rest) {
  const tokens = rest.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/[.,)]+$/, ''));
  let afterDashes = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t === '--') { afterDashes = true; continue; }
    if (t === '--test' || t.startsWith('--test=')) return true;
    if (CARGO_VALUE_FLAGS.has(t)) { i += 1; continue; }
    if (t.startsWith('-')) continue;
    if (afterDashes || TEST_NAME.test(t)) return true;
  }
  return false;
}

// The orders that run a whole suite (every test of a crate, a batch across crates, the workspace, the demo's full set):
// an unscoped `cargo test`, "the suite", "the tests", "all tests", `--workspace`. A named test or test file is not one.
export function wholeSuiteOrders(prompt) {
  const text = String(prompt || '');
  const found = [];
  for (const m of text.matchAll(CARGO_TEST_REST)) {
    if (negated(text, m.index) || compileOnly(text, m.index, m[0].length) || selectsOneTest(m[1])) continue;
    found.push(m[0].trim());
  }
  for (const re of WHOLE_SUITE_WORDS) {
    for (const m of text.matchAll(re)) if (!negated(text, m.index) && !compileOnly(text, m.index, m[0].length)) found.push(m[0].trim());
  }
  return [...new Set(found.map((s) => s.toLowerCase()))];
}

function isRustTarget(root, input) {
  try { return hasTrackedCargo(dispatchTargetRoot(root, input)); } catch { return false; }
}

const reasonGiven = (prompt) => TOKENS.tests.pattern.test(prompt) || (TOKENS.testsNone.pattern.test(prompt) && CARGO_CHECK.test(prompt));

function usesFramework(root, input) {
  try { return frameworksFor(dispatchTargetRoot(root, input)).some((f) => f.name === FRAMEWORK_NAME); } catch { return false; }
}

function signoffBlock(orders, footer) {
  return [
    `BLOCKED: this brief orders a whole suite in a repo that uses ${FRAMEWORK_NAME} (${orders.slice(0, 3).map((o) => `"${o}"`).join(', ')}) with no maintainer sign-off.`,
    '  RDG-D065: a targeted test (one named test or test file aimed at the change or fault in hand) needs no sign-off; a whole suite (every test of a crate, a batch across crates, the workspace, the demo\'s full set) never runs without his approval.',
    '  [tests: troubleshoot <fault>] and [tests: periodic batch] are not a sign-off here. Name the one test or test file (`cargo test -p <crate> --test <file>`), or verify with `cargo check`.',
    '',
    'Fix: order the one named test, say "write the test, do not run it; verify with cargo check" (or `--no-run`), or, once he has said yes in a questionnaire or in his own words, add:',
    `  ${TOKENS.testsSignoff.form}`,
    '',
    footer,
  ].join('\n');
}

export function testsBlock({ root, input, prompt, footer }) {
  const brief = String(prompt || '');
  if (TOKENS.testsSignoff.pattern.test(brief)) return null;
  const orders = testRunOrders(brief);
  if (!orders.length || !isRustTarget(root, input)) return null;
  if (usesFramework(root, input)) {
    const whole = wholeSuiteOrders(brief);
    return whole.length ? signoffBlock(whole, footer) : null;
  }
  const whole = wholeSuiteOrders(brief);
  if (!whole.length || reasonGiven(brief)) return null;
  return [
    `BLOCKED: this brief orders a whole suite as a routine step (${whole.slice(0, 3).map((o) => `"${o}"`).join(', ')}).`,
    '  Nothing runs implicitly (KIT-D162, KIT-D163): Rust builds are slow and every project shares one machine. A targeted test (one named test or test file aimed at the change or fault in hand) needs no tag; a whole suite (every test of a crate, a batch across crates, the workspace) never runs without his approval.',
    '  Default: order the one named test, or verify with `cargo check` (write tests, do not run them); the coordinator batches whole-suite runs on a quiet machine.',
    '',
    'Fix: order the one named test (`cargo test -p <crate> --test <file>`), say "write the test, do not run it; verify with cargo check", or name why a whole-suite run is wanted with one tag:',
    `  ${TOKENS.tests.form}`,
    '  [tests: periodic batch]   the coordinator\'s own batch run',
    `  ${TOKENS.testsNone.form}             no run; the brief names \`cargo check\` as the verification`,
    '',
    footer,
  ].join('\n');
}
