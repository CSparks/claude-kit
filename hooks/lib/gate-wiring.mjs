// Names the gates hooks.json lists for Stop and PreToolUse that a session never ran.
//
// A Claude Code session loads its hook wiring once, at start. A gate added to hooks.json after
// that never runs in the session, and nothing says so. The sealed launcher records a heartbeat
// for every script that does run (gate-heartbeat.mjs); this compares those with the newest
// hooks.json. Stop gates are expected on every stop. A PreToolUse gate is expected only once a
// tool its matcher covers has been used in the session.
//
// The transcript's stop_hook_summary rows give the stop count: their hook entries are anonymous
// ("command hook 10") and their count includes other plugins' hooks, so they cannot name a gate.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countStop, heartbeatRan, markWarned, toolsSeen, warnedKeys } from './gate-heartbeat.mjs';

const WATCHED_EVENTS = ['Stop', 'PreToolUse'];
const MIN_STOPS = 3;
const MIN_LIVE_STOPS = 2;
const LISTED_MAX = 6;
const SCRIPT_IN_COMMAND = /compat-run\.mjs"?\s+([a-z0-9-]+\.mjs)/;
const STOP_SUMMARY = /"subtype":"stop_hook_summary"/g;

/** The {event, script, matcher} entries of the watched events whose script exists in `hooksDir`. */
export function expectedGates(hooksJsonPath, hooksDir) {
  let wiring;
  try {
    wiring = JSON.parse(readFileSync(hooksJsonPath, 'utf8')).hooks || {};
  } catch {
    return [];
  }
  const gates = [];
  for (const event of WATCHED_EVENTS) {
    for (const group of wiring[event] || []) {
      for (const hook of group.hooks || []) {
        const script = SCRIPT_IN_COMMAND.exec(hook.command || '')?.[1];
        if (script && existsSync(join(hooksDir, script))) gates.push({ event, script, matcher: group.matcher });
      }
    }
  }
  return gates;
}

function toolCovered(matcher, seen) {
  if (!matcher) return seen.length > 0;
  let pattern;
  try {
    pattern = new RegExp(`^(?:${matcher})$`);
  } catch {
    return false;
  }
  return seen.some((tool) => pattern.test(tool));
}

/** Sorted script names expected to have run in the session and left no heartbeat. */
export function missingGates(session, gates) {
  const seen = toolsSeen(session);
  const missing = gates.filter((g) => !heartbeatRan(session, g.event, g.script)
    && (g.event === 'Stop' || toolCovered(g.matcher, seen)));
  return [...new Set(missing.map((g) => g.script))].sort();
}

export function stopRows(transcriptPath) {
  try {
    return (readFileSync(transcriptPath, 'utf8').match(STOP_SUMMARY) || []).length;
  } catch {
    return 0;
  }
}

const listed = (names) => (names.length > LISTED_MAX
  ? `${names.slice(0, LISTED_MAX).join(', ')} and ${names.length - LISTED_MAX} more`
  : names.join(', '));

/**
 * One line naming the gates missing from the session, once per session per set; '' when nothing is
 * missing, the set was already named, or the session has not run enough stops to judge. Counts the
 * stop it is called for. `p` is the Stop payload; `wiring` locates hooks.json and the hook scripts.
 */
export function wiringWarning(p, wiring) {
  const session = p?.session_id;
  if (!session || p.stop_hook_active) return '';
  if (countStop(session) < MIN_LIVE_STOPS) return '';
  const missing = missingGates(session, expectedGates(wiring.hooksJson, wiring.hooksDir));
  if (!missing.length) return '';
  const key = missing.join(',');
  if (warnedKeys(session).includes(key)) return '';
  if (stopRows(p.transcript_path) < MIN_STOPS) return '';
  markWarned(session, key);
  return `Gates listed in hooks.json never ran in this session: ${listed(missing)}. Its hook wiring predates them: restart this session to load them.`;
}
