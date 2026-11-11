// long-waits.mjs — the shell statements that park a subagent on a clock or a process (KIT-D115).
//
//   longWaits(shell) -> [description]: a sleep over MAX_SLEEP_S, or Wait-Process / Wait-Job / `timeout /t`
//
// A settle sleep of a few seconds is not a wait; anything longer is a build or test being waited on, which a
// subagent never does (its shells end with it): it scopes down or hands off. `shell` is the command with data
// arguments and inline code already removed.

const MAX_SLEEP_S = 10;
const MS_PER_S = 1000;
const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const AT_COMMAND = String.raw`(?:^|[;&|("'\n]|\bdo\b|\bthen\b)\s*`;
const SLEEP = new RegExp(`${AT_COMMAND}(?:sleep|start-sleep)\\s+(?:-(?:seconds|s)\\s+)?${NUMBER}\\b(?!\\s*ms)`, 'gi');
const SLEEP_MS = new RegExp(`${AT_COMMAND}start-sleep\\s+-(?:milliseconds|ms)\\s+${NUMBER}`, 'gi');
const WAIT_ON_PROCESS = /\b(?:wait-process|wait-job|wait-event)\b|\btimeout\s+\/t\b/i;

const longest = (re, text, scale) => Math.max(0, ...[...text.matchAll(re)].map((m) => Number(m[1]) / scale));

export function longWaits(shell) {
  const found = [];
  const seconds = Math.max(longest(SLEEP, shell, 1), longest(SLEEP_MS, shell, MS_PER_S));
  if (seconds > MAX_SLEEP_S) found.push(`a sleep of ${seconds} s: a subagent never waits on a clock (over ${MAX_SLEEP_S} s)`);
  if (WAIT_ON_PROCESS.test(shell)) found.push('Wait-Process, Wait-Job or timeout /t: a subagent never waits on a process');
  return found;
}
