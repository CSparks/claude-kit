// run-tests.mjs — `npm test` entry (KIT-T467, KIT-T570). Runs every tracked *.test.mjs as its own
// `node <file>` on a pool of KIT_TEST_WORKERS (default workers.mjs), longest first by the last run's times,
// each file with private DB, code-index, registry, turn-state and temp dirs (isolate.mjs) so no suite
// touches the maintainer's live stores or another file's. A failed file reruns once, alone: a pass
// is reported as FLAKE and does not fail the run. Files in default-state.mjs run alone afterwards. A file over KIT_TEST_MAX_FILE_S (default 0 = off; the target is 60)
// fails the run as SLOW. Wall times go to .cache/test-times.json; the slowest ten are printed.
//
// Budget (KIT-D104: no routine operation over 5 minutes): the run takes the files the change reaches (select.mjs),
// then those run longest ago, until the estimate fills KIT_TEST_BUDGET_S (default 200); the rest are listed as
// deferred and rotate in on later runs. --full, KIT_TEST_FULL=1 or --only runs the whole selection.
// --require-reached (KIT_TEST_REQUIRE_REACHED=1) refuses to run when any file the change reaches does not fit
// the budget: the files it gates on are all run or the run is refused, never silently deferred (KIT-T825).
// --owed-file <path> (KIT_TEST_OWED_FILE, what a publish sets) runs the nearest reached files that fit and writes the
// reached files that did not to <path> as a JSON array: the owed remainder of a two-phase publish (KIT-T839).
// --files <path> (KIT_TEST_FILES) runs exactly the JSON array of files in <path>, no selection and no budget;
// --failed-file <path> (KIT_TEST_FAILED_FILE) receives the failed files as a JSON array.
// A time record older than a week, or with no stamp, is stale: its file runs first among the unreached and the run rewrites the record.
//
//   node scripts/run-tests.mjs [--root <dir>] [--only <substring>] [--full] [--budget <seconds>] [--since <sha>] [--require-reached] [--owed-file <path>] [--files <path>]

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_STATE_TESTS } from './test-runner/default-state.mjs';
import { discoverTests } from './test-runner/discover.mjs';
import { isolatedEnv } from './test-runner/isolate.mjs';
import { runPool } from './test-runner/pool.mjs';
import { runFile } from './test-runner/run-file.mjs';
import { reach, changedFiles, fileCost, planRun } from './test-runner/select.mjs';
import { NO_GATE, startGate } from './test-runner/start-gate.mjs';
import { longestFirst, readRan, readStamps, readTimes, slowFiles, slowest, staleFiles, writeRan, writeTimes } from './test-runner/times.mjs';
import { defaultWorkers } from './test-runner/workers.mjs';

const SLOWEST_SHOWN = 10;
const NAMES_SHOWN = 12;
const named = (files) => `${files.slice(0, NAMES_SHOWN).join(', ')}${files.length > NAMES_SHOWN ? ', ...' : ''}`;
const DEFAULT_MAX_FILE_S = 0;
const MS_PER_S = 1000;
const flag = (name) => { const i = process.argv.indexOf(name); return i === -1 ? undefined : process.argv[i + 1]; };
const root = resolve(flag('--root') || join(dirname(fileURLToPath(import.meta.url)), '..'));
const timesFile = process.env.KIT_TEST_TIMES || join(root, '.cache', 'test-times.json');
const only = flag('--only');
const requireReached = process.argv.includes('--require-reached') || process.env.KIT_TEST_REQUIRE_REACHED === '1';
const owedFile = flag('--owed-file') || process.env.KIT_TEST_OWED_FILE;
const listed = flag('--files') || process.env.KIT_TEST_FILES;
const failedFile = flag('--failed-file') || process.env.KIT_TEST_FAILED_FILE;
const full = process.argv.includes('--full') || process.env.KIT_TEST_FULL === '1' || !!only || !!listed;
const DEFAULT_BUDGET_S = 200;
const budgetMs = (Number(flag('--budget') || process.env.KIT_TEST_BUDGET_S) || DEFAULT_BUDGET_S) * 1000;
const ranFile = join(dirname(process.env.KIT_TEST_TIMES || join(root, '.cache', 'x')), 'test-rotation.json');
const workers = Number(process.env.KIT_TEST_WORKERS) || defaultWorkers();
const maxFileMs = (process.env.KIT_TEST_MAX_FILE_S === undefined ? DEFAULT_MAX_FILE_S : Number(process.env.KIT_TEST_MAX_FILE_S)) * MS_PER_S;

const scratch = mkdtempSync(join(tmpdir(), 'kit-test-run-'));
const secs = (ms) => (ms / MS_PER_S).toFixed(1).padStart(6);
const keepDefaults = (file) => DEFAULT_STATE_TESTS.includes(file);
const attempt = (file, n) => runFile(root, file, isolatedEnv(process.env, scratch, file, n, { keepDefaults: keepDefaults(file) }));
const announce = (r) => console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${secs(r.ms)}s  ${r.file}`);

const times = readTimes(timesFile);
const stale = new Set(staleFiles(times, readStamps(timesFile)));
const wanted = listed ? new Set(JSON.parse(readFileSync(listed, 'utf8'))) : null;
const all = discoverTests(root).filter((f) => (!only || f.includes(only)) && (!wanted || wanted.has(f)));
let chosen = all;
let reached = new Map();
let owed = [];
if (!full) {
  const changed = changedFiles(root, { since: flag('--since') });
  reached = reach(root, all, changed);
  const plan = planRun({ tests: all, reached, times, stale, ranAt: readRan(ranFile), budgetMs, workers });
  chosen = plan.run;
  owed = plan.deferred.filter((f) => reached.has(f));
  if (owedFile) writeFileSync(owedFile, JSON.stringify(owed));
  if (requireReached && !owedFile && owed.length) {
    console.log(`REFUSED: ${owed.length} of the ${reached.size} files this change reaches do not fit the ${budgetMs / MS_PER_S}s budget (estimate ${(plan.estimateMs / MS_PER_S).toFixed(0)}s), so the run would gate on untested code: ${named(owed)}. Raise --budget or split the change.`);
    process.exit(1);
  }
  console.log(`budget ${budgetMs / MS_PER_S}s: running ${plan.run.length} of ${all.length} files (estimate ${(plan.estimateMs / MS_PER_S).toFixed(0)}s; ${changed.length} changed paths reach ${reached.size} tests); ${plan.deferred.length} deferred, ${owed.length} of them reached by the change${owed.length ? `: ${named(owed)}` : ''}; ${stale.size} time records older than a week, re-measured first`);
}
const files = longestFirst(chosen, times);
const started = Date.now();
const gate = full ? NO_GATE : startGate({ budgetMs, cost: fileCost(times), reached, started });
const late = [];
const timed = async (file) => {
  if (gate.skips(file)) { late.push(file); return null; }
  const r = await attempt(file, 1);
  announce(r);
  return r;
};
const first = (await runPool(files.filter((f) => !keepDefaults(f)), workers, timed)).filter(Boolean);
for (const file of files.filter(keepDefaults)) {
  const r = await timed(file);
  if (r) first.push(r);
}
const lateOwed = late.filter((f) => reached.has(f));
if (late.length) console.log(`skipped ${late.length} files that would have ended past the ${budgetMs / MS_PER_S}s budget, ${lateOwed.length} of them reached by the change: ${named(late)}`);
if (owedFile && lateOwed.length) writeFileSync(owedFile, JSON.stringify([...owed, ...lateOwed]));

const results = [];
const flakes = [];
for (const r of first) {
  if (r.ok) { results.push(r); continue; }
  console.log(`
rerunning ${r.file} alone after:
${r.output}`);
  const again = await attempt(r.file, 2);
  if (again.ok) flakes.push(r.file);
  results.push(again);
  console.log(`${again.ok ? 'FLAKE' : 'FAIL '} ${secs(again.ms)}s  ${r.file}`);
  if (!again.ok) console.log(again.output);
}
try { rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { /* a test's daemon may still hold a file; the OS temp sweep takes it */ }
writeTimes(timesFile, results.filter((r) => r.ok));
writeRan(ranFile, results.filter((r) => r.ok).map((r) => r.file));

console.log(`
slowest ${SLOWEST_SHOWN} (of ${results.length} files, ${workers} workers, ${((Date.now() - started) / MS_PER_S).toFixed(0)}s wall):`);
for (const r of slowest(results, SLOWEST_SHOWN)) console.log(`  ${secs(r.ms)}s  ${r.file}`);
const failed = results.filter((r) => !r.ok);
if (failedFile) writeFileSync(failedFile, JSON.stringify(failed.map((r) => r.file)));
const slow = maxFileMs > 0 ? slowFiles(results.filter((r) => r.ok), maxFileMs) : [];
if (flakes.length) console.log(`
${flakes.length} FLAKE (failed, then passed alone): ${flakes.join(', ')}`);
if (slow.length) console.log(`
${slow.length} SLOW (over ${maxFileMs / MS_PER_S}s): ${slow.map((r) => `${r.file} ${secs(r.ms).trim()}s`).join(', ')}`);
if (failed.length) console.log(`
${failed.length} FAILED: ${failed.map((r) => r.file).join(', ')}`);
const gatedOnUntested = requireReached && !owedFile && lateOwed.length > 0;
if (gatedOnUntested) console.log(`
REFUSED: ${lateOwed.length} files the change reaches did not start inside the budget: ${named(lateOwed)}`);
process.exit(failed.length || slow.length || gatedOnUntested ? 1 : 0);
