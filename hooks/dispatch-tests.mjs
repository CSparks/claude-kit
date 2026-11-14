// tests-not-implicit — a dispatch check for dispatch-guard (KIT-T1186, KIT-D162, KIT-D163). Rust builds are slow and
// projects share one machine, so a brief into a Cargo workspace never orders test runs as a routine step: "run the
// test", "one measuring test per point", "re-run the suite", `cargo test` as a step, "N passed" as evidence. Default
// verification is `cargo check`; agents write tests and do not run them; the coordinator batches runs on a quiet machine.
// A brief that orders runs says why with `[tests: troubleshoot <fault>]`, `[tests: periodic batch]`, or
// `[tests: none]` naming `cargo check`. A clause that forbids a run ("write the test, do not run it") is the rule itself.
// The Cargo test is `git ls-files` of the dispatch target: a Node repo, including the kit, has none and is never judged.
//
//   testRunOrders(prompt)                      -> the ordered-run phrases found, [] when none
//   testsBlock({ root, input, prompt, footer }) -> block message | null (check `tests-not-implicit`)

import { hasTrackedCargo } from '../scripts/broker/cargo-scope.mjs';
import { dispatchTargetRoot } from './dispatch-target.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

export const TESTS_CHECK = 'tests-not-implicit';

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

function isRustTarget(root, input) {
  try { return hasTrackedCargo(dispatchTargetRoot(root, input)); } catch { return false; }
}

const reasonGiven = (prompt) => TOKENS.tests.pattern.test(prompt) || (TOKENS.testsNone.pattern.test(prompt) && CARGO_CHECK.test(prompt));

export function testsBlock({ root, input, prompt, footer }) {
  const brief = String(prompt || '');
  if (reasonGiven(brief)) return null;
  const orders = testRunOrders(brief);
  if (!orders.length || !isRustTarget(root, input)) return null;
  return [
    `BLOCKED: this brief orders test runs as a routine step (${orders.slice(0, 3).map((o) => `"${o}"`).join(', ')}).`,
    '  Tests are never run implicitly (KIT-D162, KIT-D163): Rust builds are slow and every project shares one machine.',
    '  Default: verify with `cargo check`; write tests, do not run them; the coordinator batches test runs on a quiet machine.',
    '',
    'Fix: say "write the test, do not run it; verify with cargo check", or name why a run is wanted with one tag:',
    `  ${TOKENS.tests.form}`,
    '  [tests: periodic batch]   the coordinator\'s own batch run',
    `  ${TOKENS.testsNone.form}             no run; the brief names \`cargo check\` as the verification`,
    '',
    footer,
  ].join('\n');
}
