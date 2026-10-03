// attribute.mjs — failure attribution (KIT-T271). When a job's test command fails with named
// failed tests and no build error, re-run ONLY those tests on the pre-patch tree: a test that
// also fails there is FOREIGN (not the patch's doing), one that passes there is CAUSED by it.
//
// `baselineCommand(cmd, names)` builds the filtered command from the job's own: nextest gets
// `-E "test(=a) or test(=b)"`, anything else the libtest form `-- --exact a b`. Double quotes
// only — cmd.exe is the shell on Windows.
// `attribute({ command, log, runBaseline })` → { foreign: [{ test, reason }], caused: [name] }
// or null when the failure is not attributable (a build error, or no named tests).

import { readFileSync } from 'node:fs';
import { diagnose, testKey } from './diagnose.mjs';

// The job's own nextest filter is dropped: it may name a binary only the patch adds, which
// nextest rejects at base, and the failed-test filter replaces it.
const FILTERSET = /\s(?:-E|--filterset)(?:\s+|=)(?:"[^"]*"|'[^']*'|\S+)/g;

export function baselineCommand(cmd, failures) {
  const toks = String(cmd).trim().split(/\s+/);
  if (toks.includes('nextest')) {
    const one = (f) => (f.binary ? `(binary_id(=${f.binary}) and test(=${f.test}))` : `test(=${f.test})`);
    const bare = String(cmd).trim().replace(FILTERSET, '').split(/\s+/).join(' ');
    return `${bare} -E "${failures.map(one).join(' or ')}"`;
  }
  return `${toks.join(' ')}${toks.includes('--') ? '' : ' --'} --exact ${[...new Set(failures.map((f) => f.test))].join(' ')}`;
}

// The first message line under the test's `---- name stdout ----` banner, else a generic reason.
export function reasonFor(log, name) {
  const lines = String(log).split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === `---- ${name} stdout ----`);
  const line = at < 0 ? '' : lines.slice(at + 1).find((l) => l.trim());
  return (line || 'failed without the patch').trim();
}

/**
 * `command`: the failed command's result ({ cmd, failed, errors }). `runBaseline(cmd)` runs a
 * command on the pre-patch tree and returns its log path. A test the baseline log shows neither
 * failing nor passing (a filter that matched nothing) makes the failure unattributable: null.
 */
export function attribute({ command, runBaseline }) {
  const failures = command.failed || [];
  if (!failures.length || Object.keys(command.errors || {}).length) return null;
  const log = readFileSync(runBaseline(baselineCommand(command.cmd, failures)), 'utf8');
  const seen = diagnose(log);
  const keys = (list) => new Set(list.map(testKey));
  const failedBase = keys(seen.failed);
  const passedBase = keys(seen.passed);
  if (failures.some((f) => !failedBase.has(testKey(f)) && !passedBase.has(testKey(f)))) return null;
  return {
    foreign: failures.filter((f) => failedBase.has(testKey(f))).map((f) => ({ ...f, reason: reasonFor(log, f.test) })),
    caused: failures.filter((f) => !failedBase.has(testKey(f))).map((f) => f.test),
  };
}
