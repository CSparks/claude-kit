// command-limit.mjs — the time a job command may run before the daemon kills its process tree
// (KIT-T676). The limit is a multiple of the longest passing run of that exact command in the
// results history, never below a floor, so a hung test cannot hold a lane for an hour.
//
//   commandHistoryMs(cfg, cmd)  -> the longest passing duration recorded for `cmd`, 0 when none
//   commandLimitMs(cfg, cmd)    -> the limit in ms, 0 when the checkout turns timeouts off
//                                  (`command_timeout_floor_s: 0`)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';

const RECENT_RESULTS = 400;

export function commandHistoryMs(cfg, cmd) {
  const want = String(cmd).trim();
  const dir = brokerPaths(cfg).results;
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().slice(-RECENT_RESULTS); } catch { return 0; }
  let longest = 0;
  for (const f of files) {
    let commands;
    try { commands = JSON.parse(readFileSync(join(dir, f), 'utf8')).commands || []; } catch { continue; }
    for (const c of commands) {
      if (c.exit === 0 && !c.reusedFrom && String(c.cmd).trim() === want) longest = Math.max(longest, c.durationMs || 0);
    }
  }
  return longest;
}

export function commandLimitMs(cfg, cmd) {
  const t = cfg.commandTimeout;
  if (!t || !t.floorMs) return 0;
  return Math.max(t.floorMs, t.multiple * commandHistoryMs(cfg, cmd));
}

/** "10 min" / "95 s": a duration for a result message. */
export const durationText = (ms) => (ms >= 120000 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 1000)} s`);
