// command-summary.test.mjs — a result command prints as exit code, failed tests with panic location, metric lines and the log path,
// never the raw log (KIT-D116). Fixture logs are written in a temp dir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandSummary, panicLine, resultSummary } from './command-summary.mjs';
import { printResult } from './report.mjs';

const WALL = 300;
const LOG = [
  ...Array.from({ length: WALL }, (_, i) => `   Compiling dep-${i} v1.${i}.0`),
  'running 2 tests',
  'test alpha ... ok',
  'test beta::deep ... FAILED',
  '',
  'failures:',
  '',
  '---- beta::deep stdout ----',
  "thread 'beta::deep' panicked at crates/x/src/lib.rs:42:9:",
  'assertion `left == right` failed',
  '  left: 1',
  ' right: 2',
  'DRIVE km=12.5 hitches=0',
  'test result: FAILED. 1 passed; 1 failed; 0 ignored',
].join('\n');

function withLog(body, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'cmd-summary-'));
  const log = join(dir, 'c.log');
  writeFileSync(log, body);
  try { return fn(log); } finally { rmSync(dir, { recursive: true, force: true }); }
}

const failedCommand = (log) => ({ cmd: 'cargo test -p x', composed: 'cargo test -p x', exit: 101, durationMs: 4000, log, failedTests: ['beta::deep'], errors: {}, logTail: [] });

test('a failed command prints the exit, the failed test with its panic location, the DRIVE line and the log path', () => {
  withLog(LOG, (log) => {
    const lines = commandSummary(failedCommand(log));
    assert.match(lines[0], /exit 101/);
    assert.ok(lines.some((l) => /failed test: beta::deep — panicked at crates\/x\/src\/lib\.rs:42:9: assertion `left == right` failed/.test(l)), lines.join('\n'));
    assert.ok(lines.some((l) => l.trim().startsWith('DRIVE km=12.5')));
    assert.ok(lines.some((l) => l.trim().startsWith('test result: FAILED')));
    assert.equal(lines.at(-1), `    log: ${log}`);
    assert.ok(!lines.some((l) => /Compiling/.test(l)), 'no raw Compiling line reaches the summary');
    assert.ok(lines.length < 12, `compact: ${lines.length} lines`);
  });
});

test('a log tail with a Compiling wall prints folded, and its error line survives', () => {
  const tail = [...Array.from({ length: WALL }, (_, i) => `   Compiling dep-${i} v1.0.${i}`), 'error: linker `cc` not found'];
  const lines = commandSummary({ cmd: 'cargo b', exit: 1, durationMs: 1, logTail: tail });
  assert.ok(lines.some((l) => l.includes(`Compiling ×${WALL}`)));
  assert.ok(lines.some((l) => l.includes('error: linker `cc` not found')));
  assert.ok(lines.length < 6);
});

test('negative control: a passing command prints only its exit, metrics and log path', () => {
  withLog('test a ... ok\nSUMMARY ok=1\n', (log) => {
    const lines = commandSummary({ cmd: 'cargo t', exit: 0, durationMs: 9, log, failedTests: [] });
    assert.deepEqual(lines.map((l) => l.trim().split(' ')[0]), ['$', 'SUMMARY', 'log:']);
  });
});

test('panicLine is empty for a test the log does not mention', () => {
  assert.equal(panicLine(LOG.split('\n'), 'gamma'), '');
});

test('resultSummary and printResult agree on the command lines', () => {
  withLog(LOG, (log) => {
    const result = { id: 'j-1', repo: 'app', status: 'failed', phase: 'run', commands: [failedCommand(log)] };
    const printed = [];
    printResult(result, (l) => printed.push(l));
    assert.deepEqual(printed.slice(1), resultSummary(result).slice(1));
    assert.match(resultSummary(result)[0], /j-1 \[app\] → failed at run/);
  });
});
