// diagnose.mjs — pull the actionable parts out of a cargo log: rustc error blocks keyed by the
// file they point at, and the names of failed tests.

const MAX_BLOCKS = 20;
const ERROR_START = /^error(\[E\d+\])?: /;
const LOCATION = /^\s*--> (.+?):\d+:\d+/;
const FAILED_TEST = /^test (\S+) \.\.\. FAILED/;
const NEXTEST_FAIL = /^\s*FAIL \[[^\]]*\]\s+\S+\s+(\S+)/;

export function diagnose(log) {
  const errors = {};
  const failedTests = [];
  const lines = String(log).split(/\r?\n/);
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = FAILED_TEST.exec(lines[i]);
    const nt = NEXTEST_FAIL.exec(lines[i]);
    if (t || nt) { const name = (t || nt)[1]; if (!failedTests.includes(name)) failedTests.push(name); continue; }
    if (!ERROR_START.test(lines[i]) || count >= MAX_BLOCKS) continue;
    let end = i + 1;
    while (end < lines.length && lines[end].trim() !== '') end++;
    const block = lines.slice(i, end);
    const loc = block.map((l) => LOCATION.exec(l)).find(Boolean);
    (errors[loc ? loc[1].replaceAll('\\', '/') : '(unlocated)'] ||= []).push(block.join('\n'));
    count++;
    i = end;
  }
  return { errors, failedTests };
}
