// ui-pixel-literal — game UI sizes are fractions of the framework frame, never pixels. In a repo that
// carries the rapid-game framework, Rust outside `rapid-game/` that sizes UI with a pixel literal
// (`Val::Px(24.0)`) is refused; the framework (rg-ui) owns the proportional default and a game states
// intent. Check-id `ui-pixel-literal`.
//
//   uiPixelViolation(file, content, root) -> null | { line, text }

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const PIXEL_LITERAL = /\bVal::Px\(\s*-?\d/;

export function uiPixelViolation(file, content, root) {
  if (!/\.rs$/i.test(file) || !root || !existsSync(join(root, 'rapid-game'))) return null;
  const rel = relative(root, file).split('\\').join('/');
  if (rel.startsWith('..') || rel.startsWith('rapid-game/')) return null;
  const lines = String(content || '').split('\n');
  const at = lines.findIndex((l) => PIXEL_LITERAL.test(l) && !/^\s*\/\//.test(l));
  return at < 0 ? null : { line: at + 1, text: lines[at].trim().slice(0, 100) };
}
