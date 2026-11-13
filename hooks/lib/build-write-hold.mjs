// build-write-hold.mjs — no write lands in the files a running build is compiling (KIT-T1114). Every cargo build holds a
// slot of the machine build budget; the hold records the paths the build compiles (`scope`) and the agent that started it
// (`writer`, scripts/broker/build-run.mjs). A write by ANOTHER writer to a build input inside that scope, while the hold
// is not yet in its test phase, is refused: the build would compile half of two edits. A write elsewhere, a build input
// outside the scope, the writer's own writes, and the creation of a new .rs file no module names pass. A hold with no recorded scope (an older shim, a broker job) never
// refuses. The hook only refuses; it never waits (KIT-D115). The refusal names the one wait that clears it: `builds --wait`
// (scripts/broker/build-wait.mjs, KIT-T1142).
//
//   compilingHolds({ file, holds? })            -> every live hold whose build is compiling `file`, whoever started it
//   buildHoldConflict({ file, writer, holds? }) -> the hold of ANOTHER writer that compiles `file`, or null
//   describeHold(hold, now?) / holdStarter(hold) -> "pid 7, 12s, root R, cargo test" / "writer S1|a"
//   buildWaitCommand(file)                      -> the exact one-call wait for `file`, with the Bash timeout it needs
//   buildHoldMessage({ file, absFile, hold, footer }) -> the block message

import { resolve } from 'node:path';
import { liveHolds } from '../../scripts/broker/build-slot-store.mjs';
import { isBuildInput } from '../../scripts/broker/build-globs.mjs';
import { inScope } from '../../scripts/broker/cargo-scope-dirs.mjs';
import { HARNESS_FOREGROUND_S, MAX_FOREGROUND_WAIT_S } from '../../scripts/broker/wait-limits.mjs';
import { isUnreferencedNewSource } from './unreferenced-new-source.mjs';

const TESTING_PHASE = 'running';
const MS_PER_SECOND = 1000;

export function compilingHolds({ file, holds }) {
  const path = resolve(file);
  if (!isBuildInput(path) || isUnreferencedNewSource(path)) return [];
  return (holds || liveHolds()).filter((h) => h.phase !== TESTING_PHASE && Array.isArray(h.scope) && inScope(path, h.scope));
}

export const buildHoldConflict = ({ file, writer = '', holds }) => compilingHolds({ file, holds }).find((h) => (h.writer || '') !== writer) || null;

export const holdStarter = (hold) => (hold.writer ? `writer ${hold.writer}` : hold.by || 'unknown');

export function describeHold(hold, now = Date.now()) {
  const age = Math.max(0, Math.round((now - Date.parse(hold.ts)) / MS_PER_SECOND));
  return `pid ${hold.pid}, ${age}s, root ${hold.cwd}, ${String(hold.label).slice(String(hold.cwd).length + 2)}`;
}

export const buildWaitCommand = (file) => `builds --wait "${resolve(file).replace(/\\/g, '/')}" --timeout ${MAX_FOREGROUND_WAIT_S} --tool-timeout ${HARNESS_FOREGROUND_S}`;

export function buildHoldMessage({ file, absFile = file, hold, footer }) {
  return [
    `BLOCKED: a cargo build is compiling ${file}'s crate and another writer started it (KIT-T1114).`,
    `  build: ${describeHold(hold)}`,
    `  started by: ${holdStarter(hold)}`,
    '',
    'A write now lands in the sources that build reads; this edit is refused, not queued. Edits outside what the build',
    'compiles, and your own builds, are never held. Wait once, in ONE foreground call, then retry the edit:',
    `  ${buildWaitCommand(absFile)}`,
    `(Bash timeout ${HARNESS_FOREGROUND_S * MS_PER_SECOND}. It returns the moment no build compiles the file, or after ${MAX_FOREGROUND_WAIT_S} s with exit 2,`,
    'naming the holder and how long it held. Past that, write your handoff or do work that touches no file of that crate.)',
    '',
    footer,
  ].join('\n');
}
