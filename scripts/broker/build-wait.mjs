// build-wait.mjs — `builds --wait <file>` (KIT-T1142): the one sanctioned wait for a write the build-write hold refused
// (hooks/lib/build-write-hold.mjs). It blocks, once and in the foreground, until no live build compiles <file> — the
// condition under which the refused edit passes — or until the cap, and prints who held and for how long.
//
//   builds --wait <file> [--writer <session|agent>] [--timeout <s>] [--tool-timeout <s>] [--poll <ms>]
//     exit 0  no build compiles the file (none did, or the holders ended or began their test phase); the file's writer then
//             has FREE_WINDOW_S before another writer's build may start on it (write-window.mjs, KIT-T1175)
//     exit 2  still compiling at the cap: the holder is named; hand off or work elsewhere, do not wait again in a loop
//   --timeout is cut to fit the Bash call (--tool-timeout, default 120 s) and the harness's 180 s window (wait-limits.mjs).
//
//   capSeconds(flags)                     -> the seconds the wait may block
//   waitForBuild({ file, capS, pollMs, writer }) -> { free, holders: [{ line, heldS }], waitedS }
//     while a build compiles the file the wait keeps the writer's pending-edit window open, so the next build start of
//     another writer yields to it
//   runWait(argv)                         -> exit code, printing the outcome

import { parseFlags } from './cli.mjs';
import { liveHolds } from './build-slot-store.mjs';
import { compilingHolds, describeHold, holdStarter } from '../../hooks/lib/build-write-hold.mjs';
import { waitWindow } from './wait-limits.mjs';
import { BATCH_CEILING_S, BATCH_IDLE_S, FREE_WINDOW_S, KIND, REFUSED_WINDOW_S, openWindow } from './write-window.mjs';
import { closeBatchRefusals } from './batch-refusal.mjs';

// The writer a `builds --wait` without --writer belongs to: the hook wraps the command with it (hooks/lib/build-wrap.mjs, KIT-T1281).
const WRITER_ENV = 'CLAUDE_KIT_BUILD_WRITER';

const EXIT = { FREE: 0, HELD: 2 };
const HOLD_PROMISE = `For ${FREE_WINDOW_S}s no other writer's build of this crate, or of a crate that depends on it, starts; once the batch's first edit passes, the hold lasts until the batch has landed, while it spends at most ${BATCH_IDLE_S}s idle between edits (time in the hooks does not count) and never past ${BATCH_CEILING_S}s from that edit (KIT-T1408, KIT-T1425).`;
const DEFAULT_POLL_MS = 1000;
const MS_PER_SECOND = 1000;
const seconds = (ms) => Math.max(0, Math.round(ms / MS_PER_SECOND));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const capSeconds = (flags) => waitWindow(flags, { subagent: true }).seconds;

/** Polls the live holds until none compiles `file` or `capS` runs out. `holders` lists every build seen, last sighting each. */
export async function waitForBuild({ file, capS, pollMs = DEFAULT_POLL_MS, read = liveHolds, writer = '' }) {
  const begun = Date.now();
  const seen = new Map();
  for (;;) {
    const now = Date.now();
    const compiling = compilingHolds({ file, holds: read() });
    if (compiling.length) openWindow({ file, writer, seconds: REFUSED_WINDOW_S, kind: KIND.REFUSED });
    for (const hold of compiling) seen.set(hold.pid, { line: `${describeHold(hold, now)}; started by ${holdStarter(hold)}`, heldS: seconds(now - Date.parse(hold.ts)) });
    const waitedS = seconds(now - begun);
    if (!compiling.length) return { free: true, holders: [...seen.values()], waitedS };
    if (now - begun >= capS * MS_PER_SECOND) return { free: false, holders: [...seen.values()], waitedS };
    await sleep(pollMs);
  }
}

export async function runWait(argv) {
  const flags = parseFlags(argv);
  if (typeof flags.wait !== 'string') {
    console.error('builds --wait: a file path is required (builds --wait <file> [--timeout <s>] [--tool-timeout <s>])');
    return EXIT.HELD;
  }
  const writer = typeof flags.writer === 'string' ? flags.writer : (process.env[WRITER_ENV] || '');
  const { free, holders, waitedS } = await waitForBuild({ file: flags.wait, capS: capSeconds(flags), pollMs: Number(flags.poll) || DEFAULT_POLL_MS, writer });
  if (free) {
    openWindow({ file: flags.wait, writer, seconds: FREE_WINDOW_S, kind: KIND.FREE });
    closeBatchRefusals({ writer });
  }
  if (!holders.length) {
    console.log(`builds --wait: no build is compiling ${flags.wait}; the edit passes now. ${HOLD_PROMISE}`);
    return EXIT.FREE;
  }
  for (const h of holders) console.log(`builds --wait: ${free ? 'stopped compiling after' : 'still compiling after'} ${h.heldS}s: ${h.line}`);
  console.log(free ? `builds --wait: ${flags.wait} is free after waiting ${waitedS}s; send the whole batch now. ${HOLD_PROMISE}` : `builds --wait: still compiling after waiting ${waitedS}s (cap reached): hand off or work elsewhere (exit ${EXIT.HELD})`);
  return free ? EXIT.FREE : EXIT.HELD;
}
