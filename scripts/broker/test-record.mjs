// test-record.mjs — resume an interrupted nextest run (KIT-T518). A daemon that died, was stopped
// or was killed by the watchdog mid-test leaves the command's log on disk, one `PASS` line per
// finished test. The restart reads that log, keeps the passes in a per-job record
// (`<broker home>/testrun/<job>.json`) and reruns only the tests not yet passed: the command gains
// `-E "not (<passes>)"`, ANDed with the command's own filterset. The record belongs to one input
// key (tree state, patch, commands); any change to those discards it and the run is full.
//
//   isNextestRun(cmd, cwd)           -> true for `cargo nextest run …` and aliases that expand to it
//   excluding(cmd, passed)           -> { cmd, skipped }  the command with the passes filtered out
//   testRecord(cfg, job, inputKey)   -> { prepare(n, cmd, cwd, logPath) -> { cmd, skipped }, clear() }
//
// Outcomes come from nextest's own PASS lines in the streamed log; a killed run keeps every line
// printed before the kill. Trains and suite runs do not use it.

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readAliases } from './alias.mjs';
import { brokerPaths } from './config.mjs';
import { cacheGet, cachePut } from './cache.mjs';
import { diagnose, testKey } from './diagnose.mjs';

const NAME = 'testrun';
const FILTERSET = /\s(?:-E|--filterset)(?:\s+|=)("[^"]*"|'[^']*'|\S+)/g;
const SAFE = /^[\w:.\-/<>,]+$/;
// cmd.exe, the Windows shell, refuses a command line past 8191 characters.
const MAX_COMMAND_CHARS = 7000;

export function isNextestRun(cmd, cwd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1) return false;
  const sub = toks[ci + 1];
  if (sub === 'nextest') return toks[ci + 2] === 'run';
  const alias = cwd ? readAliases(cwd)[sub] : null;
  return !!alias && alias[0] === 'nextest' && alias[1] === 'run';
}

const unquote = (s) => (/^(["']).*\1$/.test(s) ? s.slice(1, -1) : s);

function groupByBinary(passed, room) {
  const groups = new Map();
  let used = 0;
  let count = 0;
  for (const t of passed) {
    if (!t.binary || !SAFE.test(t.binary) || !SAFE.test(t.test)) continue;
    const add = `test(=${t.test}) or `.length + (groups.has(t.binary) ? 0 : `(binary_id(=${t.binary}) and ()) or `.length);
    if (used + add > room) continue;
    used += add;
    count++;
    if (!groups.has(t.binary)) groups.set(t.binary, []);
    groups.get(t.binary).push(t.test);
  }
  const text = [...groups].map(([bin, names]) => `(binary_id(=${bin}) and (${names.map((n) => `test(=${n})`).join(' or ')}))`).join(' or ');
  return { text, count };
}

/** `cmd` with `passed` ([{ binary, test }]) filtered out; unchanged when there is nothing safe to exclude. */
export function excluding(cmd, passed) {
  const whole = String(cmd).trim();
  const toks = whole.split(/\s+/);
  const sep = toks.indexOf('--');
  const head = (sep === -1 ? toks : toks.slice(0, sep)).join(' ');
  const tail = sep === -1 ? '' : ` ${toks.slice(sep).join(' ')}`;
  const own = [...head.matchAll(FILTERSET)].map((m) => unquote(m[1]));
  if (own.length > 1 || own.some((e) => e.includes('"'))) return { cmd: whole, skipped: 0 };
  const bare = head.replace(FILTERSET, '');
  const noTests = bare.includes('--no-tests') ? '' : ' --no-tests=pass';
  const wrapper = ` -E "not ()"`.length + (own.length ? own[0].length + 12 : 0);
  const { text, count } = groupByBinary(passed, MAX_COMMAND_CHARS - bare.length - tail.length - noTests.length - wrapper);
  if (!count) return { cmd: whole, skipped: 0 };
  const expr = own.length ? `(${own[0]}) and not (${text})` : `not (${text})`;
  return { cmd: `${bare}${noTests} -E "${expr}"${tail}`, skipped: count };
}

const merge = (into, more) => {
  const seen = new Set(into.map(testKey));
  for (const t of more) if (!seen.has(testKey(t))) { seen.add(testKey(t)); into.push(t); }
};

export function testRecord(cfg, job, inputKey) {
  const stored = cacheGet(cfg, NAME, job.id);
  const resumed = !!stored && stored.key === inputKey;
  const record = resumed ? stored : { key: inputKey, runs: {} };
  return {
    resumed,
    prepare(n, cmd, cwd, logPath) {
      if (!isNextestRun(cmd, cwd)) return { cmd, skipped: 0 };
      const before = record.runs[n];
      const run = before && before.cmd === cmd ? before : { cmd, passed: [] };
      if (resumed && existsSync(logPath)) merge(run.passed, diagnose(readFileSync(logPath, 'utf8')).passed);
      record.runs[n] = run;
      cachePut(cfg, NAME, job.id, { key: record.key, runs: record.runs });
      return excluding(cmd, run.passed);
    },
    clear() { rmSync(join(brokerPaths(cfg).home, NAME, `${job.id}.json`), { force: true }); },
  };
}
