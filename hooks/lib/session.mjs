// Freshness of the session anchor (.ai/SESSION.md). The plan-of-record going stale is
// "itself a failure" per the contract, so orient surfaces it in one line and flush checks
// whether the anchor was touched this turn. FAIL-OPEN: any missing file / git hiccup
// returns the clean result so orientation never breaks.

import { statSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './exec.mjs';
import { MS_PER_DAY } from './time.mjs';

// Is SESSION.md staler than the project's last commit? Compares SESSION's mtime against the
// last commit's author date (epoch seconds). Returns { stale, sessionDays } — stale only when
// SESSION pre-dates the last commit AND a commit exists.
export function sessionStale(root) {
  try {
    const session = join(root, '.ai', 'SESSION.md');
    const sMtime = statSync(session).mtimeMs;
    const lastCommit = git(['-C', root, 'log', '-1', '--format=%ct']).trim();
    if (!lastCommit) return { stale: false, sessionDays: 0 };
    const commitMs = Number(lastCommit) * 1000;
    const sessionDays = Math.max(0, Math.floor((Date.now() - sMtime) / MS_PER_DAY));
    return { stale: sMtime < commitMs, sessionDays };
  } catch {
    return { stale: false, sessionDays: 0 };
  }
}

// SESSION.md's mtime in epoch ms, or 0 when it can't be stat'd. The Stop-anchor nudge
// (flush.mjs) asks "was SESSION touched THIS turn?" — a timestamp comparison against the
// turn start, distinct from sessionStale's "older than the last commit" SessionStart check.
// A 0 is treated as "not touched"; the nudge then fires, the safe side for a durability check.
export function sessionMtimeMs(root) {
  try {
    return statSync(join(root, '.ai', 'SESSION.md')).mtimeMs;
  } catch {
    return 0;
  }
}
