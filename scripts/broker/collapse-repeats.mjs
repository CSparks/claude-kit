// collapse-repeats.mjs — child-process output the kit prints never repeats itself (KIT-D116). A run of the same
// (or near-same) line becomes one line with a count: "Compiling x412 (last: foo v0.1.0)", "queued, position 3 (repeated 40x)".
// A line that reports a failure (error, panic, FAILED, assertion) is never collapsed, even when it repeats.
//
//   collapseRepeats(lines, { min? })        -> lines with each run of >= min near-same lines folded into one
//   repeatPrinter(write, { key? })          -> { line(text), flush() }: prints a line at once, then the "(repeated N×)" tally when the line changes
//   normalizeKey(line)                      -> what "near-same" means: digits, hex and durations ignored

const MIN_RUN = 3;
const CARGO_VERB = /^\s*(Compiling|Checking|Fresh|Downloading|Downloaded|Building|Updating|Blocking|Locking|Documenting|Running)\b\s*(.*)$/;
const SIGNAL = /^\s*(error|fatal|thread '.*' panicked|assertion|---- .* stdout ----)|panicked at|\bFAILED\b/i;

const verbOf = (line) => CARGO_VERB.exec(line);
export const isSignal = (line) => !verbOf(line) && SIGNAL.test(line);

export function normalizeKey(line) {
  const verb = verbOf(line);
  if (verb) return verb[1];
  return line.trim().replace(/0x[0-9a-f]+/gi, '#').replace(/\d+(\.\d+)?/g, '#');
}

// A wait heartbeat that only moved its clock ("running 60s", "running 120s") is the same line; a moved queue position is not.
export const heartbeatKey = (line) => line.replace(/\b\d+s\b/g, 'Ns');

function fold(run) {
  const verb = verbOf(run[0]);
  if (verb) return `${verb[1]} ×${run.length} (last: ${verbOf(run[run.length - 1])[2]})`;
  return `${run[0]} (repeated ${run.length}×)`;
}

export function collapseRepeats(lines, { min = MIN_RUN } = {}) {
  const out = [];
  let run = [];
  const close = () => { out.push(...(run.length >= min ? [fold(run)] : run)); run = []; };
  for (const line of lines) {
    const foldable = line.trim() !== '' && !isSignal(line);
    if (foldable && run.length && normalizeKey(run[0]) === normalizeKey(line)) { run.push(line); continue; }
    close();
    if (foldable) run = [line]; else out.push(line);
  }
  close();
  return out;
}

export function repeatPrinter(write, { key = normalizeKey } = {}) {
  let last = null;
  let count = 0;
  const flush = () => {
    if (count > 1) write(`${last} (repeated ${count}×)`);
    last = null;
    count = 0;
  };
  return {
    line(text) {
      if (last !== null && !isSignal(text) && key(text) === key(last)) { count++; return; }
      flush();
      last = text;
      count = 1;
      write(text);
    },
    flush,
  };
}
