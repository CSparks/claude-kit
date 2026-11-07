// build-checkpoint.mjs — a build is checked, never killed blind (KIT-D137). A broker command that runs a long time is looked
// at every CHECKPOINT_MS: what it is building, how that compares with its history, what else shares the machine, and
// whether it progressed since the last look (log output, or CPU in its process tree). A progressing build continues, however
// long it has run; a stalled one is stopped at the check, so an incremental build never hangs for half an hour. The line
// goes to the command's log, the broker's stderr and a note file beside the log that the waiter's heartbeat repeats.
//
//   checkpointWatch({ logPath, pid, limitMs, historyMs?, intervalMs?, list?, own?, say? }) -> { poll(elapsedMs), close() }
//     pid: the command's root process; limitMs: its history-scaled budget (command-limit.mjs).
//     poll(elapsedMs) -> null between checks; at a check -> { line, stop } with `stop` set (a reason) when the command stalled.
//   A budget under the interval is the interval, so a project's short limit still ends a silent hang at that limit.
//   Past `limitMs` a command that prints nothing and runs no compiler is stopped too (a hung test holds no lane, KIT-T676).
//   A process list that cannot be read never stops a command on CPU alone.
//   CLAUDE_KIT_CHECKPOINT_MS=<ms> moves the interval (tests).

import { appendFileSync } from 'node:fs';
import { durationText } from './command-limit.mjs';
import { foreignBuilds, governedPids, listProcesses, summarize } from './build-contention.mjs';
import { cpuByPid, cpuGain, isCompiler, logPhase, logWindow, treeOf } from './build-progress.mjs';
import { clearNote, writeNote } from './build-note.mjs';

const MS_PER_MIN = 60000;
const CHECK_MINUTES = 5;
export const CHECKPOINT_MS = CHECK_MINUTES * MS_PER_MIN;
const INTERVAL_ENV = 'CLAUDE_KIT_CHECKPOINT_MS';
const configuredIntervalMs = () => Number(process.env[INTERVAL_ENV]) || CHECKPOINT_MS;
const MIN_CPU_MS = 50;
const CPU_SHARE = 0.02;
const HALF = 2;

const phaseText = (p) => (p.phase === 'compiling' ? `compiling ${p.crates.join(', ')} (${p.compiled} crates compiled so far)` : p.phase === 'testing' ? `running ${p.target}` : 'no cargo output yet');

function warmthText(historyMs, elapsedMs) {
  if (!historyMs) return 'cold: no passing run of this command on record, so no estimate';
  const last = `warm: the last passing run took ${durationText(historyMs)}`;
  return elapsedMs > historyMs ? `${last}, this run is past it` : `${last}, about ${durationText(historyMs - elapsedMs)} left`;
}

const rivalsText = (rivals) => (rivals.length ? `slow because other cargo builds share the machine: ${rivals.join('; ')}` : 'no other cargo build is running');

function consoleAndLog(logPath) {
  return (line) => {
    appendFileSync(logPath, `\n[broker] ${line}\n`);
    writeNote(logPath, line);
    console.error(`broker: ${line}`);
  };
}

export function checkpointWatch({ logPath, pid, limitMs, historyMs = 0, intervalMs = configuredIntervalMs(), list = listProcesses, own = governedPids, say = consoleAndLog(logPath) }) {
  const sample = (at) => {
    const rows = list();
    const tree = treeOf(rows, pid);
    return { at, rows, tree, observed: tree.length > 0, cpu: cpuByPid(tree), ...logWindow(logPath) };
  };
  const every = limitMs ? Math.min(intervalMs, limitMs) : intervalMs;
  let before = { at: 0, size: 0, cpu: new Map(), baseline: false };
  let nth = 1;

  function verdict(now) {
    const grew = now.size - before.size;
    const span = now.at - before.at;
    const gain = now.observed ? cpuGain(before.cpu, now.tree) : 0;
    const cpuOk = gain >= Math.max(MIN_CPU_MS, span * CPU_SHARE);
    const beyond = now.at >= limitMs;
    const idle = grew <= 0;
    let stop = null;
    if (idle && (now.observed ? !cpuOk : beyond)) stop = `no log output and no CPU in the build tree for ${durationText(span)}`;
    else if (idle && beyond && now.observed && !now.tree.some(isCompiler)) stop = `past its ${durationText(limitMs)} budget with no log output and no compiler running (a hung test)`;
    return { grew, gain, stop };
  }

  return {
    poll(elapsedMs) {
      if (!before.baseline && elapsedMs >= every / HALF) before = { ...sample(elapsedMs), baseline: true };
      if (elapsedMs < nth * every) return null;
      const now = sample(elapsedMs);
      const { grew, gain, stop } = verdict(now);
      const where = `${durationText(nth * every)} check: ${phaseText(logPhase(now.text))}; ${warmthText(historyMs, elapsedMs)}; ${rivalsText(summarize(foreignBuilds(now.rows, own())))}`;
      const line = stop ? `${where}; STALLED, stopping the build: ${stop}` : `${where}; progressing (log +${Math.max(0, grew)} B, CPU +${durationText(gain)}), continuing`;
      say(line);
      before = { ...now, baseline: true };
      nth += 1;
      return { line, ...(stop ? { stop } : {}) };
    },
    close() { clearNote(logPath); },
  };
}
