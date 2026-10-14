// landgate.mjs — the landing gate (KIT-T472). With `land_gate: affected` a `--land` job runs a
// compile check of every target, the test targets its changed paths map to (affected.mjs), and
// the worker's own targeted commands; suite-shaped commands leave the gate and run on the suite
// cadence (suite.mjs). A path the map cannot place falls back to the job's full commands.
//
// `landGate(cfg, cwd, job, paths)` → null (run the job's commands as given) or
//   { commands, selection: { reasons, dropped } }.
// `isSuiteShaped(cmd, suite)` → true for a suite command (modulo -j / --no-fail-fast) or an
//   unfiltered `cargo test`.

import { selectAffected } from './affected.mjs';

const SELECTORS = new Set(['--test', '--tests', '--lib', '--bin', '--bins', '--example', '--examples', '--doc', '--bench']);
const TAKES_VALUE = new Set(['-p', '--package', '--features', '-F', '--profile', '-j', '--jobs', '--target', '--manifest-path', '--config', '-Z', '--exclude']);
const TEST_SUBS = new Set(['test', 't']);

const normalize = (cmd) => {
  const toks = String(cmd).trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '-j' || toks[i] === '--jobs') { i++; continue; }
    if (toks[i] !== '--no-fail-fast') out.push(toks[i]);
  }
  return out.join(' ');
};

function unfilteredTest(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1 || !TEST_SUBS.has(toks[ci + 1])) return false;
  for (let i = ci + 2; i < toks.length; i++) {
    const t = toks[i];
    if (t === '--') return toks.length === i + 1 || toks.slice(i + 1).every((a) => a.startsWith('-'));
    if (SELECTORS.has(t)) return false;
    if (TAKES_VALUE.has(t)) { i++; continue; }
    if (!t.startsWith('-')) return false;
  }
  return true;
}

export function isSuiteShaped(cmd, suite) {
  const n = normalize(cmd);
  return suite.some((s) => normalize(s) === n) || unfilteredTest(cmd);
}

export function landGate(cfg, cwd, job, paths) {
  if (cfg.landGate !== 'affected') return null;
  const sel = selectAffected(cwd, paths);
  if (sel.unmapped.length) return null;
  const given = Array.isArray(job.commands) && job.commands.length ? job.commands : [];
  const dropped = given.filter((c) => isSuiteShaped(c, cfg.suite));
  const tests = [...sel.crates].filter(([, specs]) => specs.size).map(([name, specs]) => `${cfg.affected.test} -p ${name} ${[...specs].join(' ')}`);
  const commands = [...new Set([cfg.affected.check, ...tests, ...given.filter((c) => !dropped.includes(c))])];
  return { commands, selection: { reasons: sel.reasons, dropped } };
}
