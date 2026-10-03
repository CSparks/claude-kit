// diagnose.mjs — pull the actionable parts out of a cargo log: rustc error blocks keyed by the
// file they point at, and the failed tests. `failed`/`passed` are [{ binary, test }] (binary is null for libtest);
// `failedTests` is the plain name list.

const MAX_BLOCKS = 20;
const ERROR_START = /^error(\[E\d+\])?: /;
// Test-run closers, not build errors: nextest's `error: test run failed`, cargo test's `error: test failed, to rerun pass ...` and `error: N target(s) failed:` (its indented target lines are no error start).
const RUN_TRAILER = /^error: (test run failed\s*$|test failed, to rerun pass |\d+ targets? failed:)/;
const LOCATION = /^\s*--> (.+?):\d+:\d+/;
const FAILED_TEST = /^test (\S+) \.\.\. FAILED/;
// nextest: `FAIL [ 0.1s] (38/48) <binary-id> <test name>`; the (n/m) counter is optional.
const NEXTEST = /^\s*(FAIL|PASS) \[[^\]]*\]\s+(?:\(\s*\d+\/\d+\)\s+)?(\S+)\s+(\S+)/;
const PASSED_TEST = /^test (\S+) \.\.\. ok/;
export const testKey = (t) => `${t.binary || ''}|${t.test}`;

export function diagnose(log) {
  const errors = {};
  const failed = [];
  const passed = [];
  const add = (list, t) => { if (!list.some((x) => testKey(x) === testKey(t))) list.push(t); };
  const lines = String(log).split(/\r?\n/);
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const lt = FAILED_TEST.exec(lines[i]);
    const ok = PASSED_TEST.exec(lines[i]);
    const nt = NEXTEST.exec(lines[i]);
    if (lt) { add(failed, { binary: null, test: lt[1] }); continue; }
    if (ok) { add(passed, { binary: null, test: ok[1] }); continue; }
    if (nt) { add(nt[1] === 'FAIL' ? failed : passed, { binary: nt[2], test: nt[3] }); continue; }
    if (!ERROR_START.test(lines[i]) || RUN_TRAILER.test(lines[i]) || count >= MAX_BLOCKS) continue;
    let end = i + 1;
    while (end < lines.length && lines[end].trim() !== '') end++;
    const block = lines.slice(i, end);
    const loc = block.map((l) => LOCATION.exec(l)).find(Boolean);
    (errors[loc ? loc[1].replaceAll('\\', '/') : '(unlocated)'] ||= []).push(block.join('\n'));
    count++;
    i = end;
  }
  return { errors, failedTests: [...new Set(failed.map((t) => t.test))], failed, passed };
}
