#!/usr/bin/env node
// dispatch-ui.test.mjs — the ui-framework-first dispatch check: UI sizing/layout briefed to a generic
// agent in a rapid-game repo is blocked; the specialist, the checked token, other work and other repos pass.
// Run: node hooks/dispatch-ui.test.mjs

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UI_CHECK, uiBlock, uiWork } from './dispatch-ui.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const game = mkdtempSync(join(tmpdir(), 'kit-ui-game-'));
mkdirSync(join(game, 'rapid-game'));
const plain = mkdtempSync(join(tmpdir(), 'kit-ui-plain-'));
const block = (root, type, prompt) => uiBlock({ root, input: { subagent_type: type }, prompt, footer: `check ${UI_CHECK}` });

try {
  const BRIEF = 'Build the HUD speedometer: font size 24px, anchored bottom right, gap 8px';
  check('a HUD sizing brief to the generic patch-worker is blocked', block(game, 'claude-kit:patch-worker', BRIEF) !== null);
  check('the block names the specialist and the escape token', /rg-ui-engineer/.test(block(game, 'general-purpose', BRIEF)) && /ui-framework-checked/.test(block(game, 'general-purpose', BRIEF)));
  check('the specialist passes', block(game, 'claude-kit:rg-ui-engineer', BRIEF) === null);
  check('the checked token passes', block(game, 'claude-kit:patch-worker', `${BRIEF} [ui-framework-checked: rg-ui UiFrame, no pixels]`) === null);
  check('an empty token does not count', block(game, 'claude-kit:patch-worker', `${BRIEF} [ui-framework-checked: ]`) !== null);
  check('non-UI work passes', block(game, 'claude-kit:patch-worker', 'Fix the tire friction curve in the physics step') === null);
  check('a UI noun without sizing or layout passes', block(game, 'claude-kit:patch-worker', 'Rename the menu enum variant and update the callers') === null);
  check('a repo without the framework passes', block(plain, 'claude-kit:patch-worker', BRIEF) === null);
  check('uiWork needs a noun and a sizing word', uiWork('menu layout') && !uiWork('menu') && !uiWork('padding'));
} finally {
  rmSync(game, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
