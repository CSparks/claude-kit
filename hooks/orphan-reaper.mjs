#!/usr/bin/env node
// SessionStart + Stop + SubagentStop + PostToolUse(Bash) — the PROCESS REAPER (KIT-T697, KIT-T633, KIT-T634,
// KIT-T699). Ends `tail`/`grep` watchers whose parent shell is gone (lib/process-reaper.mjs) and runaway
// python / spinning interpreters left under Bash-tool shells (lib/runaway.mjs, check-id runaway-process).
// Listing processes costs seconds, so a hook event only SPAWNS one detached run (throttled by a stamp) and
// returns; the run writes what it ended to the per-user state dir and the next SessionStart prints it as one
// line per reaper. Never a daemon: each run exits when done.
//
//   node orphan-reaper.mjs          hook mode: print last run's report, spawn a detached run when due
//   node orphan-reaper.mjs --run    one reap, report left for the next SessionStart
//   node orphan-reaper.mjs --now    one reap in the foreground, always printing both counts
//
// Never touches a process whose parent is alive, a claude process, or a broker-owned process. Fail-open.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reapOrphans } from './lib/process-reaper.mjs';
import { CHECK_ID, reapRunaways } from './lib/runaway.mjs';
import { lastReapMs, reapStampPath, takeReport, writeReport } from './lib/reap-state.mjs';
import { gitRoot, pathExcluded, payload } from './lib.mjs';

const SELF = fileURLToPath(import.meta.url);
const MS_PER_MIN = 60000;
const THROTTLE_MIN = { SessionStart: 1, default: 5 };

async function reapAll() {
  const root = gitRoot();
  const watchers = reapOrphans();
  const runaways = await reapRunaways({ skip: (p) => pathExcluded(root, CHECK_ID, p.name) });
  return { watchers, runaways };
}

const reportLines = ({ watchers, runaways }) => [
  ...(watchers.reaped.length ? [watchers.line] : []),
  ...(runaways.reaped.length ? [runaways.line] : []),
];

try {
  if (process.argv.includes('--now')) {
    const r = await reapAll();
    console.log(r.watchers.line);
    console.log(r.runaways.line);
  } else if (process.argv.includes('--run')) {
    writeReport(reportLines(await reapAll()));
  } else {
    const p = await payload();
    const stamp = reapStampPath();
    if (p.hook_event_name === 'SessionStart') for (const line of takeReport()) console.log(line);
    const interval = (THROTTLE_MIN[p.hook_event_name] ?? THROTTLE_MIN.default) * MS_PER_MIN;
    if (Date.now() - lastReapMs(stamp) >= interval) {
      writeFileSync(stamp, String(Date.now()));
      spawn(process.execPath, [SELF, '--run'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
  }
} catch { /* fail-open */ }
process.exit(0);
