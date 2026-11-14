// build-write-hold.mjs — no write lands in the files a running build is compiling (KIT-T1114). Every cargo build holds a
// slot of the machine build budget; the hold records the paths the build compiles (`scope`) and the agent that started it
// (`writer`, scripts/broker/build-run.mjs). A write by ANOTHER writer to a build input inside that scope, while the hold
// is not yet in its test phase, is refused: the build would compile half of two edits. A write elsewhere, a build input
// outside the scope, the writer's own writes, and any .rs file no module chain reaches (new or existing) pass. A hold with no recorded scope (an older shim, a broker job) never
// refuses. The hook only refuses; it never waits (KIT-D115). The refusal names the one wait that clears it: `builds --wait`
// (scripts/broker/build-wait.mjs, KIT-T1142).
//
//   compilingHolds({ file, holds? })            -> every live hold whose build is compiling `file`, whoever started it
//   buildHoldConflict({ file, writer, holds? }) -> the hold of ANOTHER writer that compiles `file`, or null
//   describeHold(hold, now?) / holdStarter(hold) -> "pid 7, 12s, root R, cargo test" / "writer S1|a"
//   buildWaitCommand(file)                      -> the exact one-call wait for `file`, with the Bash timeout it needs
//   holdScopeLines({ absFile, hold })           -> the refusal lines saying which dependency chain puts `absFile` in the
//                                                  build's scope and, for a wide hold, why the scope is wide (KIT-T1147)
//   buildHoldMessage({ file, absFile, hold, footer, writer }) -> the block message; says whether a build that started after a
//                                                  free `builds --wait` is NEW or the same one compiling again (KIT-T1175)
//   noteRefusedEdit({ file, writer }) / noteEditLanded({ file, writer }) -> open / close the writer's write window on the file
//                                                  (scripts/broker/write-window.mjs): a build start yields to it

import { resolve } from 'node:path';
import { liveHolds } from '../../scripts/broker/build-slot-store.mjs';
import { isBuildInput } from '../../scripts/broker/build-globs.mjs';
import { inScope, scopeVia } from '../../scripts/broker/cargo-scope-dirs.mjs';
import { HARNESS_FOREGROUND_S, MAX_FOREGROUND_WAIT_S } from '../../scripts/broker/wait-limits.mjs';
import { FREE_WINDOW_S, KIND, REFUSED_WINDOW_S, closeWindow, openWindow, windowFor } from '../../scripts/broker/write-window.mjs';
import { isUnreachableSource } from './unreachable-source.mjs';
import { toPath } from './shell-segments.mjs';

const TESTING_PHASE = 'running';
const MS_PER_SECOND = 1000;

export function compilingHolds({ file, holds }) {
  const path = resolve(toPath(file));
  if (!isBuildInput(path) || isUnreachableSource(path)) return [];
  return (holds || liveHolds()).filter((h) => h.phase !== TESTING_PHASE && Array.isArray(h.scope) && inScope(path, h.scope));
}

export const buildHoldConflict = ({ file, writer = '', holds }) => compilingHolds({ file, holds }).find((h) => (h.writer || '') !== writer) || null;

export const holdStarter = (hold) => (hold.writer ? `writer ${hold.writer}` : hold.by || 'unknown');

export function describeHold(hold, now = Date.now()) {
  const age = Math.max(0, Math.round((now - Date.parse(hold.ts)) / MS_PER_SECOND));
  return `pid ${hold.pid}, ${age}s, root ${hold.cwd}, ${String(hold.label).slice(String(hold.cwd).length + 2)}`;
}

export const buildWaitCommand = (file, writer = '') => `builds --wait "${resolve(toPath(file)).replace(/\\/g, '/')}"${writer ? ` --writer "${writer}"` : ''} --timeout ${MAX_FOREGROUND_WAIT_S} --tool-timeout ${HARNESS_FOREGROUND_S}`;

const clock = (iso) => String(iso).slice(11, 19);

function lastWindow(file) {
  try {
    return windowFor({ file });
  } catch {
    return null;
  }
}

/** The refusal line saying what happened since `builds --wait` last returned free for the file: a new build, or the same one compiling again. */
export function afterWaitLines({ window, hold }) {
  if (!window || window.kind !== KIND.FREE) return [];
  return Date.parse(hold.ts) > Date.parse(window.ts)
    ? [`  note: this build is NEW: it started at ${clock(hold.ts)}Z, after builds --wait returned free at ${clock(window.ts)}Z`]
    : [`  note: this build was already running when builds --wait returned free at ${clock(window.ts)}Z; it began compiling again (the next target) since`];
}

/** Records the refused edit as a pending-edit window, so the next build start of another writer yields to it. */
export function noteRefusedEdit({ file, writer }) {
  try {
    openWindow({ file, writer, seconds: REFUSED_WINDOW_S, kind: KIND.REFUSED });
  } catch {
    /* the refusal stands without its window */
  }
}

/** The writer's edit of `file` passed: the window held for it ends. */
export const noteEditLanded = ({ file, writer }) => closeWindow({ file, writer });

export function holdScopeLines({ absFile, hold }) {
  const chain = scopeVia(absFile, hold.scopeVia);
  return [
    ...(chain ? [`  why this file: it is reached through ${chain}`] : []),
    ...(hold.scopeReason ? [`  scope: wider than the build's dependency closure because ${hold.scopeReason}`] : []),
  ];
}

export function buildHoldMessage({ file, absFile = file, hold, footer, window = lastWindow(absFile), writer = '' }) {
  return [
    `BLOCKED: a cargo build is compiling ${file}'s crate and another writer started it (KIT-T1114).`,
    `  build: ${describeHold(hold)}`,
    `  started by: ${holdStarter(hold)}`,
    ...holdScopeLines({ absFile, hold }),
    ...afterWaitLines({ window, hold }),
    '',
    'A write now lands in the sources that build reads; this edit is refused, not queued. Edits outside what the build',
    'compiles, and your own builds, are never held. Wait once, in ONE foreground call, then retry the edit:',
    `  ${buildWaitCommand(absFile, writer)}`,
    `(Bash timeout ${HARNESS_FOREGROUND_S * MS_PER_SECOND}. It returns the moment no build compiles the file, or after ${MAX_FOREGROUND_WAIT_S} s with exit 2,`,
    `naming the holder and how long it held. After it returns free, no other writer's build starts on the file for ${FREE_WINDOW_S} s: retry the edit at once.`,
    'Past the cap, write your handoff or do work that touches no file of that crate.)',
    '',
    footer,
  ].join('\n');
}
