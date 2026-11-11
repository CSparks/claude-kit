// ui-framework-first — a dispatch check for dispatch-guard. UI, HUD, menu and screen work belongs to the
// framework specialist (claude-kit:rg-ui-engineer) or carries the framework-first check: where the
// repo carries the rapid-game framework, a brief that sizes or lays out UI and goes to a generic agent
// is blocked until it names the framework mechanism it reuses. A read-only agent builds no UI and passes.
// A UI noun and a sizing word count only within one clause (a few words apart); file names and identifiers are ignored.
//
//   uiBlock({ root, input, prompt, footer }) -> block message | null (check `ui-framework-first`)
//
// Escape: `[ui-framework-checked: <the rg-ui mechanism reused, or why none applies>]` in the prompt.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TOKENS } from './lib/gate-tokens.mjs';
import { readOnlyDispatch } from './dispatch-readonly.mjs';

export const UI_CHECK = 'ui-framework-first';
const CHECKED = TOKENS.uiFrameworkChecked.pattern;
const UI_NOUN = /\b(?:hud|ui|menu|menus|screen|screens|panel|widget|overlay)\b/i;
// Sizing words by how strongly they signal UI; graphics and level briefs use the loose ones for other things.
const SIZING_UI = ['font[- ]size', 'val::px', 'ppu', 'margin', 'padding', 'safe area'];
const SIZING_LOOSE = ['px', 'pixels?', 'gap', 'anchor', 'scale', 'resolution'];
const SIZING_LAYOUT = ['layout'];
// A brief carrying one of these vocabularies is not about UI frames: the sizing groups it names mean
// something else there (a floor plan, a pixel probe) and are dropped; UI-only words still count.
const CONTEXTS = [
  { vocab: /\b(?:procedural(?:ly)?|dungeons?|rooms?|levels?|world[- ]?gen(?:eration)?|tilemaps?|floor ?plans?|chunks?)\b/i, drops: [SIZING_LAYOUT] },
  { vocab: /\b(?:shaders?|wgsl|glsl|sky|skybox|clouds?|raymarch(?:ing|ed)?|fragment|vertex|rg-graphics|renderer|rendering|gpu|volumetric|atmosphere|lighting|textures?|meshes|mesh)\b/i, drops: [SIZING_LAYOUT, SIZING_LOOSE] },
];
const sizingWords = (text) => {
  const dropped = CONTEXTS.filter((c) => c.vocab.test(text)).flatMap((c) => c.drops);
  const kept = [SIZING_UI, SIZING_LOOSE, SIZING_LAYOUT].filter((group) => !dropped.includes(group));
  return new RegExp(`\\b(?:${kept.flat().join('|')})\\b`, 'i');
};
// A UI noun and a sizing word describe UI work only when they sit in the same clause: a long brief holds both
// words far apart (a "debug overlay" bullet, a "safety margin" bullet) without sizing any UI.
const NEAR_WORDS = 8;
const CLAUSE_BREAK = /[.;!?\n]\s/;
// File names and code identifiers (screens.rs, menu_pad, hud/mod.rs) name code, not a UI being built.
const CODE_TOKEN = /\S*(?:[_/\\]|\.[a-z]{1,5}\b)\S*/gi;
const nearEachOther = (text, noun, sizing) => {
  const nouns = [...text.matchAll(new RegExp(noun.source, 'gi'))].map((m) => m.index);
  const sizes = [...text.matchAll(new RegExp(sizing.source, 'gi'))].map((m) => m.index);
  return nouns.some((n) => sizes.some((s) => {
    const span = text.slice(Math.min(n, s), Math.max(n, s));
    return span.split(/\s+/).length <= NEAR_WORDS + 1 && !CLAUSE_BREAK.test(span);
  }));
};
const SPECIALIST = /(?:^|:)rg-ui-engineer$/i;
// patch-worker writes through the broker, so it builds UI although its own Write tool is confined.
const PATCH_WORKER = /(?:^|:)patch-worker$/i;

export function uiWork(prompt) {
  const text = String(prompt || '').replace(CODE_TOKEN, ' ');
  return nearEachOther(text, UI_NOUN, sizingWords(text));
}

export function uiBlock({ root, input, prompt, footer }) {
  const type = String(input.subagent_type || input.agent_type || '').trim();
  if (SPECIALIST.test(type) || CHECKED.test(prompt)) return null;
  if (!PATCH_WORKER.test(type) && readOnlyDispatch(root, type, prompt)) return null;
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
