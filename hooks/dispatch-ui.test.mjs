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
  const LEVELGEN = 'Plan procedural level and room generation: room layouts, corridor layout, dungeon floor plans, how screens of rooms stream in. Read-only.';
  check('a level/room generation brief with "layout" is not UI work', block(game, 'Plan', LEVELGEN) === null && !uiWork(LEVELGEN));
  check('a menu layout brief that mentions a level still blocks on sizing words', uiWork('level select menu: padding 8px'));
  check('uiWork needs a noun and a sizing word', uiWork('menu layout') && !uiWork('menu') && !uiWork('padding'));
  const SKY = 'Tune the sky clouds shader: rg-graphics sky/clouds.rs and sky.wgsl. Pixel probes on the screen overlay at top-to-base edge coverage; frame cost at 4K resolution, scale the layer gap.';
  check('a sky/clouds shader brief is not UI work', block(game, 'claude-kit:patch-worker', SKY) === null && !uiWork(SKY));
  check('a HUD brief that mentions a shader still blocks on UI-only sizing', uiWork('HUD speedometer shader: font size 24px, padding 8px'));
  check('a UI sizing brief is still blocked next to the sky brief', block(game, 'claude-kit:patch-worker', BRIEF) !== null);
  const INVENTORY = 'Inventory the other repo: UI, physics, audio. The HUD uses font size 24px and a gap of 8px; list what exists, read-only.';
  check('a read-only Explore inventory that lists UI passes', block(game, 'Explore', INVENTORY) === null && uiWork(INVENTORY));
  check('read-only Plan and analyst types pass', block(game, 'Plan', INVENTORY) === null && block(game, 'claude-kit:analyst', INVENTORY) === null);
  check('a [read-only:] declaration on a writer type passes', block(game, 'general-purpose', `${INVENTORY} [read-only: inventory only]`) === null);
  check('the same brief to a writer type still blocks', block(game, 'general-purpose', INVENTORY) !== null);
  check('patch-worker still blocks despite its confined Write', block(game, 'claude-kit:patch-worker', INVENTORY) !== null);
  const ENEMY_AI = [
    'Build enemy AI floor safety in marblequest. Enemies read the levelled floor map (a ledge, a pit, a ring of raised cells) and never steer over an edge.',
    'Keep a safety margin of 0.5 m from a ledge, scale the probe distance with speed, and anchor the probe at the enemy feet.',
    'Keep frame cost low: one map query per frame. The map layout is per dungeon cell. Files under 300 lines.',
    'Tests: grid_bug_floor_safe, ram_tank_pit_ring; run the screens.rs and menu_pad suites untouched. A debug overlay is out of scope.',
  ].join('\n');
  check('an enemy-AI floor-safety build brief is not UI work', block(game, 'claude-kit:implementer', ENEMY_AI) === null && !uiWork(ENEMY_AI));
  const FIT_TEXT = 'Fit the pause menu labels: shrink the font size until the text fits the panel, padding 12px, then wrap.';
  const SCROLL_NAV = 'Add a scrolling list to the inventory screen: anchor the list to the screen edge, gap 8px between rows, d-pad nav.';
  check('a text-fitting menu brief still blocks', block(game, 'claude-kit:implementer', FIT_TEXT) !== null);
  check('a scroll-list and nav screen brief still blocks', block(game, 'claude-kit:implementer', SCROLL_NAV) !== null);
  check('a UI noun and a sizing word in different clauses is not UI work', !uiWork('Fix the menu enum variant.\nKeep a safety margin from the ledge.') && uiWork('the menu: padding 8px'));
  check('a file name holding a UI noun does not count', !uiWork('Edit screens.rs and hud/mod.rs, keep a safety margin'));
} finally {
  rmSync(game, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
