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
import { diagnose } from './diagnose.mjs';

export function baselineCommand(cmd, names) {
  const toks = String(cmd).trim().split(/\s+/);
  if (toks.includes('nextest')) return `${toks.join(' ')} -E "${names.map((n) => `test(=${n})`).join(' or ')}"`;
  return `${toks.join(' ')}${toks.includes('--') ? '' : ' --'} --exact ${names.join(' ')}`;
}

// The first message line under the test's `---- name stdout ----` banner, else a generic reason.
export function reasonFor(log, name) {
  const lines = String(log).split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === `---- ${name} stdout ----`);
  const line = at < 0 ? '' : lines.slice(at + 1).find((l) => l.trim());
  return (line || 'failed without the patch').trim();
}

/**
 * `command`: the failed command's result ({ cmd, failedTests, errors }). `runBaseline(cmd)` runs
 * a command on the pre-patch tree and returns its log path.
 */
export function attribute({ command, runBaseline }) {
  const names = [...new Set(command.failedTests || [])];
  if (!names.length || Object.keys(command.errors || {}).length) return null;
  const logPath = runBaseline(baselineCommand(command.cmd, names));
  const log = readFileSync(logPath, 'utf8');
  const failedBase = new Set(diagnose(log).failedTests);
  const foreign = names.filter((n) => failedBase.has(n)).map((test) => ({ test, reason: reasonFor(log, test) }));
  return { foreign, caused: names.filter((n) => !failedBase.has(n)) };
}
