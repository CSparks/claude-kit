// stuck-hooks.mjs — kit hook processes that outlived their call (KIT-T1289).
// A hook lives for seconds (hook-limits.mjs), so a process whose command line holds compat-run.mjs and that
// is older than MIN_AGE_MS is stuck. The hook shell `bash -c "node compat-run.mjs <hook>"` stayed alive for
// 44 hours at 1.6 cores after its parent died and its node child ended.
//
//   MIN_AGE_MS
//   stuckHooks(table, { now? })       -> [{ proc, ageMs, orphaned }] hook processes over MIN_AGE_MS, never claude or this process
//   stuckHooksLine(table, { now? })   -> one housekeeping line naming each with pid, age and cpu time, else null
//
// `table` is process-tree.processTable(). A process is orphaned when its parent is gone from the table, or
// runs but started after the child (a reused pid).

import { isClaude } from './process-tree.mjs';

export const MIN_AGE_MS = 5 * 60 * 1000;
const HOOK_LAUNCHER = /compat-run\.mjs/;
const MS_PER_MIN = 60000;
const MS_PER_S = 1000;
const LISTED = 6;

export function stuckHooks(table, { now = Date.now() } = {}) {
  const byPid = new Map(table.map((p) => [p.pid, p]));
  return table
    .filter((p) => HOOK_LAUNCHER.test(p.command || '') && !isClaude(p) && p.pid !== process.pid && now - p.startedMs >= MIN_AGE_MS)
    .map((proc) => {
      const parent = byPid.get(proc.ppid);
      return { proc, ageMs: now - proc.startedMs, orphaned: !parent || parent.startedMs > proc.startedMs };
    });
}

const describe = ({ proc, ageMs, orphaned }) => {
  const name = String(proc.name).replace(/\.exe$/i, '');
  return `pid ${proc.pid} ${name} ${Math.floor(ageMs / MS_PER_MIN)} min old, ${Math.round(proc.cpuMs / MS_PER_S)} s cpu${orphaned ? ', parent gone' : ''}`;
};

export function stuckHooksLine(table, opts) {
  const stuck = stuckHooks(table, opts);
  if (!stuck.length) return null;
  const more = stuck.length > LISTED ? ` (+${stuck.length - LISTED} more)` : '';
  return `STUCK KIT HOOKS: ${stuck.slice(0, LISTED).map(describe).join('; ')}${more}. A hook ends in seconds; the orphan reaper ends the ones whose parent is gone or that spin, and the rest need a manual stop.`;
}
