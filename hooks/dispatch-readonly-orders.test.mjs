#!/usr/bin/env node
// dispatch-readonly-orders.test.mjs — the readonly-orders dispatch check (KIT-T1488): a brief that orders cargo, builds --run,
// restore-tree or a test run for analyst, analyst-max, researcher or code-reviewer is blocked and pointed at implementer or
// perf-tuner; a forbidding clause, an evidence citation, a run another agent makes and a writer-capable type pass.
// Run: node hooks/dispatch-readonly-orders.test.mjs

import { READONLY_ORDERS_CHECK, readOnlyOrders, readOnlyOrdersBlock } from './dispatch-readonly-orders.mjs';
import { expect, finish, makeRepo, run } from './dispatch-guard-harness.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};
const block = (type, prompt) => readOnlyOrdersBlock({ type, prompt, footer: `check ${READONLY_ORDERS_CHECK}` });

const ORDERS = [
  ['the incident bisect: restore-tree plus cargo runs', 'Bisect the test: restore-tree 1a2b3c4 crates/rg-townplan, then cargo run the probe for each state, then restore-tree --back crates/rg-townplan.'],
  ['a cargo test', 'Step 2: cargo test -p rg-flora --test walls.'],
  ['a cargo check', 'Verify with cargo check -p rg-flora.'],
  ['a builds --run', 'Start it with builds --run "cargo build" --out target/b.txt.'],
  ['run the tests', 'After reading the code, run the tests and report the failures.'],
  ['npm test', 'Then npm test in the app folder.'],
  ['a test file', 'Run node hooks/foo.test.mjs once.'],
  ['a run order beside a cited command', 'The log shows cargo test failed. Now run cargo test -p x and report.'],
  ['a run order beside a described command', 'Today cargo r builds these into the maintainer\'s game. Run cargo r and report what it builds.'],
  ['a run order whose command is followed by a verb', 'Run cargo test -p x prints nothing; read the output.'],
  ['an order to verify what a command builds', 'Check that cargo r builds these into the maintainer\'s game.'],
  ['an order to confirm a command passes', 'Confirm cargo test -p x passes on main.'],
];
for (const [name, prompt] of ORDERS) {
  for (const type of ['claude-kit:analyst', 'claude-kit:analyst-max', 'claude-kit:researcher', 'claude-kit:code-reviewer', 'analyst']) {
    check(`blocks ${name} for ${type}`, block(type, prompt) !== null);
  }
}

const PASSING = [
  ['a forbidding clause', 'Do not run cargo, builds --run or restore-tree; read the code only.'],
  ['never run', 'You never run cargo test: the coordinator does.'],
  ['the evidence of an earlier run', 'The evidence: cargo test -p x failed 3 of 7 on the last run.'],
  ['a run another agent makes', 'The implementer runs cargo test -p x afterwards; you only review the diff.'],
  ['a run by the coordinator', 'Verification (run by the coordinator): cargo check -p x.'],
  ['a command already run', 'cargo test -p x was run on main and printed the failure below.'],
  ['a blockquote of command output', '> cargo test -p x\n> test result: FAILED. 3 passed; 4 failed\n\nExplain the failure from the source.'],
  ['a sentence with no command', 'Trace how the lane host caches its output and name the file that owns it.'],
  ['the word cargo as a noun', 'Trace the cargo manifest handling in the workspace loader.'],
  ['the incident: a sentence describing what cargo r builds', 'Today cargo r builds these into the maintainer\'s game.'],
  ['a described command with flags', 'cargo build -p road-generator --release produces the shipped exe.'],
  ['a described restore-tree', 'restore-tree puts the named folder back at an old commit.'],
];
for (const [name, prompt] of PASSING) check(`passes ${name} for analyst-max`, block('claude-kit:analyst-max', prompt) === null);

for (const type of ['claude-kit:implementer', 'claude-kit:perf-tuner', 'general-purpose', '(default)']) {
  check(`a writer-capable type ${type} is never judged`, block(type, ORDERS[0][1]) === null);
}

const found = readOnlyOrders(ORDERS[0][1]);
check('the scanner names restore-tree and the cargo order', found.includes('restore-tree') && found.some((o) => o.startsWith('cargo run')));
const text = block('claude-kit:analyst-max', ORDERS[0][1]);
check('the block names the type, the writer types and the ticket', /claude-kit:analyst-max/.test(text) && /implementer or perf-tuner/.test(text) && /KIT-T1488/.test(text));
check('the block ends with the exclusion footer', text.endsWith(`check ${READONLY_ORDERS_CHECK}`));
check('an empty prompt is no brief to judge', block('analyst', '') === null && block('analyst', undefined) === null);

const dir = makeRepo();
const send = (type, prompt) => run(dir, { subagent_type: type, model: 'opus', prompt });
const flagged = (type, prompt) => { const r = send(type, prompt); return r.code === 2 && r.err.includes(`id: ${READONLY_ORDERS_CHECK}`) ? 2 : 0; };
expect('guard: analyst-max ordered to run cargo is blocked', flagged('claude-kit:analyst-max', 'Run cargo test -p x. [read-only: investigation]'), 2);
expect('guard: implementer given the same order is not blocked by this check', flagged('claude-kit:implementer', 'Run cargo test -p x. [read-only: investigation]'), 0);
expect('guard: analyst-max told not to run cargo is not blocked by this check', flagged('claude-kit:analyst-max', 'Do not run cargo. [read-only: investigation]'), 0);

console.log(`\ndispatch-readonly-orders: ${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
finish();
