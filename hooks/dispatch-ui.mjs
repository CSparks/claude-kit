// ui-framework-first — a dispatch check for dispatch-guard. UI, HUD, menu and screen work belongs to the
// framework specialist (claude-kit:rg-ui-engineer) or carries the framework-first check: where the
// repo carries the rapid-game framework, a brief that sizes or lays out UI and goes to a generic agent
// is blocked until it names the framework mechanism it reuses.
//
//   uiBlock({ root, input, prompt, footer }) -> block message | null (check `ui-framework-first`)
//
// Escape: `[ui-framework-checked: <the rg-ui mechanism reused, or why none applies>]` in the prompt.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const UI_CHECK = 'ui-framework-first';
const CHECKED = /\[ui-framework-checked:\s*[^\]\s][^\]]*\]/i;
const UI_NOUN = /\b(?:hud|ui|menu|menus|screen|screens|panel|widget|overlay)\b/i;
const UI_SIZING = /\b(?:px|pixels?|font[- ]size|val::px|ppu|layout|margin|padding|gap|anchor|scale|resolution|safe area)\b/i;
const SPECIALIST = /(?:^|:)rg-ui-engineer$/i;

export function uiWork(prompt) {
  const text = String(prompt || '');
  return UI_NOUN.test(text) && UI_SIZING.test(text);
}

export function uiBlock({ root, input, prompt, footer }) {
  const type = String(input.subagent_type || input.agent_type || '').trim();
  if (SPECIALIST.test(type) || CHECKED.test(prompt)) return null;
  if (!existsSync(join(root, 'rapid-game'))) return null;
  if (!uiWork(prompt)) return null;
  return [
    'BLOCKED: this brief sizes or lays out UI, and the rapid-game framework owns that.',
    `  agent: ${type || '(default)'}`,
    '',
    'UI mechanisms (frames, tokens, fit-text, nav, lint) live in rg-ui / rg-ui-bevy, with proportional defaults:',
    'a game states intent, never pixels. Read rapid-game/docs/CRATES.md and UI_MANIFESTO.md before building any of it in the game.',
    '',
    'Fix: dispatch claude-kit:rg-ui-engineer (it builds the mechanism in the framework), or add',
    '[ui-framework-checked: <the rg-ui mechanism this reuses, or why none applies>] to the prompt.',
    '',
    footer,
  ].join('\n');
}
