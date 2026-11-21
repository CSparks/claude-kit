// composed-claude — the stamp that ties ~/.claude/CLAUDE.md to the sources it was built from (KIT-T1463). bootstrap.mjs
// writes the hash of the public base plus the private overlay into the composed file; orient compares it on every start
// and warns on the first line when the sources moved on, so a rule committed to the base never silently fails to load.
//
//   sourceHash(base, overlay)   -> sha256 hex of the raw base text and the raw overlay text
//   stampLine(hash)             -> the comment line bootstrap writes under the GENERATED header
//   composedState({ claudeHome, kitRoot, privDir }) -> { state, expected, found }
//                                  state: 'fresh' | 'stale' | 'unstamped' | 'missing' | 'no-source'
//   staleWarning(opts)          -> the one-line orient warning, '' when fresh, missing or without a base source
//   orientWarning()             -> staleWarning for this machine (CLAUDE_HOME, CLAUDE_KIT_PRIVATE) and the kit this script runs from

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAMP = /^<!-- source-hash: ([0-9a-f]{64}) -->$/m;
const OVERLAY_SEPARATOR = '\n<!-- overlay -->\n';

export const sourceHash = (base, overlay) => createHash('sha256').update(`${base || ''}${OVERLAY_SEPARATOR}${overlay || ''}`).digest('hex');

export const stampLine = (hash) => `<!-- source-hash: ${hash} -->`;

const readIf = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

export function composedState({ claudeHome, kitRoot, privDir }) {
  const composed = join(claudeHome, 'CLAUDE.md');
  const baseFile = join(kitRoot, 'user-config', 'CLAUDE.global.md');
  if (!existsSync(baseFile)) return { state: 'no-source' };
  if (!existsSync(composed)) return { state: 'missing' };
  const expected = sourceHash(readIf(baseFile), readIf(join(privDir || join(claudeHome, 'private'), 'CLAUDE.md')));
  const found = STAMP.exec(readFileSync(composed, 'utf8'))?.[1];
  if (!found) return { state: 'unstamped', expected };
  return { state: found === expected ? 'fresh' : 'stale', expected, found };
}

export const orientWarning = () => staleWarning({
  claudeHome: process.env.CLAUDE_HOME || join(homedir(), '.claude'),
  kitRoot: fileURLToPath(new URL('..', import.meta.url)),
  privDir: process.env.CLAUDE_KIT_PRIVATE,
});

export function staleWarning(opts) {
  const { state } = composedState(opts);
  if (state !== 'stale' && state !== 'unstamped') return '';
  return `!! GLOBAL INSTRUCTIONS OUT OF DATE (${state}): ${join(opts.claudeHome, 'CLAUDE.md')} was built from older sources, so rules added since do not load. Run \`node "${join(opts.kitRoot, 'bootstrap.mjs')}"\`, then restart the session.`;
}
