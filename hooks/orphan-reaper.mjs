#!/usr/bin/env node
// SessionStart + Stop — the ORPHAN REAPER (KIT-T697, KIT-T633, KIT-T634). Ends `tail`/`grep` watchers
// whose parent shell is gone (lib/process-reaper.mjs) so they stop polling the disk and lagging input.
// SessionStart reaps at once and prints one line when it ended any; Stop reaps at most every
// REAP_INTERVAL_MS (a stamp file under ~/.claude/claude-kit-state), because listing processes costs about a second.
// `node hooks/orphan-reaper.mjs --now` reaps and always prints the count. Never touches a process
// whose parent is alive. Backstop to broker-log-gate. Fail-open: exits 0 on any error.

import { writeFileSync } from 'node:fs';
import { lastReapMs, reapOrphans, reapStampPath } from './lib/process-reaper.mjs';
import { payload } from './lib.mjs';

const REAP_INTERVAL_MS = 10 * 60 * 1000;

try {
  const now = process.argv.includes('--now');
  const stamp = reapStampPath();
  const p = now ? {} : await payload();
  if (!now && p.hook_event_name === 'Stop' && Date.now() - lastReapMs(stamp) < REAP_INTERVAL_MS) process.exit(0);
  const { reaped, line } = reapOrphans();
  try { writeFileSync(stamp, String(Date.now())); } catch { /* stamp is best-effort */ }
  if (now || reaped.length) console.log(line);
} catch { /* fail-open */ }
process.exit(0);
