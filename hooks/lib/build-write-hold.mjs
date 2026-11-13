// build-write-hold.mjs — no write lands in the files a running build is compiling (KIT-T1114). Every cargo build holds a
// slot of the machine build budget; the hold records the paths the build compiles (`scope`) and the agent that started it
// (`writer`, scripts/broker/build-run.mjs). A write by ANOTHER writer to a build input inside that scope, while the hold
// is not yet in its test phase, is refused: the build would compile half of two edits. A write elsewhere, a build input
// outside the scope, and the writer's own writes pass. A hold with no recorded scope (an older shim, a broker job) never
// refuses. The hook only refuses; it never waits (KIT-D115).
//
//   buildHoldConflict({ file, writer, holds? }) -> the hold that compiles `file`, or null
//   buildHoldMessage({ file, hold, footer })    -> the block message

import { resolve } from 'node:path';
import { liveHolds } from '../../scripts/broker/build-slot-store.mjs';
import { isBuildInput } from '../../scripts/broker/build-globs.mjs';

const TESTING_PHASE = 'running';
const MS_PER_SECOND = 1000;
const slash = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const within = (file, scope) => file === slash(scope) || file.startsWith(`${slash(scope)}/`);

export function buildHoldConflict({ file, writer = '', holds }) {
  const abs = slash(resolve(file));
  if (!isBuildInput(abs)) return null;
  const live = holds || liveHolds();
  return live.find((h) => h.phase !== TESTING_PHASE && (h.writer || '') !== writer && Array.isArray(h.scope) && h.scope.some((s) => within(abs, s))) || null;
}

export function buildHoldMessage({ file, hold, footer }) {
  const age = Math.max(0, Math.round((Date.now() - Date.parse(hold.ts)) / MS_PER_SECOND));
  return [
    `BLOCKED: a cargo build is compiling ${file}'s crate and another writer started it (KIT-T1114).`,
    `  build: pid ${hold.pid}, ${age}s, root ${hold.cwd}, ${String(hold.label).slice(String(hold.cwd).length + 2)}`,
    `  started by: ${hold.writer ? `writer ${hold.writer}` : hold.by || 'unknown'}`,
    '',
    'A write now lands in the sources that build reads. Retry after the build finishes (`builds` lists it); this edit is',
    'refused, not queued. Edits outside what the build compiles, and your own builds, are never held.',
    '',
    footer,
  ].join('\n');
}
