#!/usr/bin/env node
// dispatch-unattended.test.mjs — the dispatch-unattended warning (KIT-T1492): a brief into a rapid-game repo that orders a game
// run (launch check, probe flight, screenshot capture) without naming RG_UNATTENDED draws a NOTE on stderr and is never blocked
// by it; naming the variable, a forbidding clause, another repo and the ignore file draw none.
// Run: node hooks/dispatch-unattended.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UNATTENDED_CHECK, gameRunOrders, unattendedWarning } from './dispatch-unattended.mjs';
import { expect, finish, ignoreFile, makeRepo, run } from './dispatch-guard-harness.mjs';

const frameworkRepo = () => {
  const dir = makeRepo();
  writeFileSync(join(dir, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n\turl = ../rapid-game\n');
  return dir;
};
const framework = frameworkRepo();
const plain = makeRepo();
const send = (dir, prompt) => run(dir, { subagent_type: 'general-purpose', model: 'opus', prompt });
const noted = (dir, prompt) => { const r = send(dir, prompt); return r.err.includes('KIT-T1492') ? 1 : 0; };

const ORDERS = [
  ['a launch check', 'After the change, do a launch check and read the first frames.'],
  ['a probe flight', 'Run a probe flight over the town and write the numbers to a file.'],
  ['a screenshot capture', 'Do a screenshot capture of the plaza.'],
  ['owner-shot', 'Run owner-shot on the plaza seed.'],
  ['start the game', 'Start the game and watch the log.'],
];
for (const [name, prompt] of ORDERS) {
  expect(`warns on ${name} in a rapid-game repo`, noted(framework, prompt), 1);
  expect(`never blocks on ${name}`, send(framework, prompt).code, 0);
}

const QUIET = [
  ['RG_UNATTENDED named', 'Do a launch check with RG_UNATTENDED=1 set.'],
  ['a forbidding clause', 'Do not start the game; read the code only.'],
  ['no game run', 'Rename the menu enum variant and update the callers.'],
];
for (const [name, prompt] of QUIET) expect(`no warning for ${name}`, noted(framework, prompt), 0);

expect('a repo without rapid-game is not judged', noted(plain, ORDERS[0][1]), 0);
expect('the ignore file lifts the warning', send(ignoreFile(frameworkRepo(), UNATTENDED_CHECK), ORDERS[0][1]).err.includes('KIT-T1492') ? 1 : 0, 0);
expect('the scanner names the order', gameRunOrders(ORDERS[1][1]).includes('probe flight') ? 1 : 0, 1);
expect('an empty brief warns of nothing', unattendedWarning({ root: framework, input: {}, prompt: '' }) === '' ? 1 : 0, 1);

finish();
