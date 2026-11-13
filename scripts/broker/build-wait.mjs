// build-wait.mjs — `builds --wait <file>` (KIT-T1142): the one sanctioned wait for a write the build-write hold refused
// (hooks/lib/build-write-hold.mjs). It blocks, once and in the foreground, until no live build compiles <file> — the
// condition under which the refused edit passes — or until the cap, and prints who held and for how long.
//
//   builds --wait <file> [--timeout <s>] [--tool-timeout <s>] [--poll <ms>]
//     exit 0  no build compiles the file (none did, or the holders ended or began their test phase)
//     exit 2  still compiling at the cap: the holder is named; hand off or work elsewhere, do not wait again in a loop
//   --timeout is cut to fit the Bash call (--tool-timeout, default 120 s) and the harness's 180 s window (wait-limits.mjs).
//
//   capSeconds(flags)                     -> the seconds the wait may block
//   waitForBuild({ file, capS, pollMs })  -> { free, holders: [{ line, heldS }], waitedS }
//   runWait(argv)                         -> exit code, printing the outcome

import { parseFlags } from './cli.mjs';
import { liveHolds } from './build-slot-store.mjs';
import { compilingHolds, describeHold, holdStarter } from '../../hooks/lib/build-write-hold.mjs';
import { waitWindow } from './wait-limits.mjs';

const EXIT = { FREE: 0, HELD: 2 };
const DEFAULT_POLL_MS = 1000;
const MS_PER_SECOND = 1000;
const seconds = (ms) => Math.max(0, Math.round(ms / MS_PER_SECOND));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const capSeconds = (flags) => waitWindow(flags, { subagent: true }).seconds;

/** Polls the live holds until none compiles `file` or `capS` runs out. `holders` lists every build seen, last sighting each. */
export async function waitForBuild({ file, capS, pollMs = DEFAULT_POLL_MS, read = liveHolds }) {
  const begun = Date.now();
  const seen = new Map();
  for (;;) {
    const now = Date.now();
    const compiling = compilingHolds({ file, holds: read() });
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
  const { free, holders, waitedS } = await waitForBuild({ file: flags.wait, capS: capSeconds(flags), pollMs: Number(flags.poll) || DEFAULT_POLL_MS });
  if (!holders.length) {
    console.log(`builds --wait: no build is compiling ${flags.wait}; the edit passes now`);
    return EXIT.FREE;
  }
  for (const h of holders) console.log(`builds --wait: ${free ? 'stopped compiling after' : 'still compiling after'} ${h.heldS}s: ${h.line}`);
  console.log(free ? `builds --wait: ${flags.wait} is free after waiting ${waitedS}s; retry the edit` : `builds --wait: still compiling after waiting ${waitedS}s (cap reached): hand off or work elsewhere (exit ${EXIT.HELD})`);
  return free ? EXIT.FREE : EXIT.HELD;
}
