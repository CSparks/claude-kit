#!/usr/bin/env node
// dispatch-background-run.test.mjs — the background-run dispatch check (KIT-T1161): a brief that backgrounds
// cargo run or cargo test, or starts a program in the background without the built exe, is blocked; the built-exe form,
// a forbidding clause and unrelated briefs pass.
// Run: node hooks/dispatch-background-run.test.mjs

import { BACKGROUND_RUN_CHECK, backgroundRunBlock } from './dispatch-background-run.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};
const block = (prompt) => backgroundRunBlock({ prompt, footer: `check ${BACKGROUND_RUN_CHECK}` });

const BLOCKED = [
  ['cargo run in the background', 'Review the town. Run cargo run -p road-generator in the background and look at the log.'],
  ['run_in_background on cargo run', 'Use run_in_background for `cargo run --release --bin probe`.'],
  ['cargo test in the background', 'Start cargo test -p rg-townplan in the background, then read the output.'],
  ['background first, cargo after', 'In the background, launch cargo run for the fly probe.'],
  ['start it in the background alone', 'Probe the flythrough: start it in the background and check the log when done.'],
  ['start the game in the background', 'Start the game in the background and capture frames.'],
];
for (const [name, prompt] of BLOCKED) check(`blocks ${name}`, block(prompt) !== null);

const PASSES = [
  ['the built-exe form', 'Build with cargo build, then start target/debug/road-generator.exe in the background and end your turn.'],
  ['the words built exe', 'Run cargo test --no-run, then start the built exe in the background and end the turn.'],
  ['a release path', 'Start target/release/probe in the background, end your turn.'],
  ['a forbidding clause', 'Never run cargo run or cargo test in the background; build in the foreground.'],
  ['a foreground cargo run', 'Run cargo run -p demo in ONE foreground call of at most 170 seconds.'],
  ['no run at all', 'Rename the menu enum variant and update the callers.'],
  ['background without cargo or start', 'The background colour of the panel is grey; tune it.'],
];
for (const [name, prompt] of PASSES) check(`passes ${name}`, block(prompt) === null);

const message = block(BLOCKED[0][1]) || '';
check('the block names the built-exe form and the rule file', /target\/debug\/<name>\.exe/.test(message) && /docs\/wait-rule\.md/.test(message));
check('the block ends with the exclusion footer', message.endsWith(`check ${BACKGROUND_RUN_CHECK}`));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
