// suite.mjs — the full-suite cadence (KIT-T472). With `land_gate: affected` landings skip the
// full suite; the daemon runs `suite` (default verify_default) on the committed HEAD when the queue
// is idle and `suite_every` landings have accumulated since the last run. A queued job cancels the
// run (it re-runs later), so the suite never delays a landing. The tree is never checked out or
// rewritten: a hand-edited build path skips the run, and Cargo.lock is restored afterwards.
//
// Each run writes `<broker home>/suite/<sha>.json`. A red run files ONE `cap regression` per set
// of failing tests, naming the range since the last green run, the failing tests, and the
// landings whose paths map to the failing targets (suite-blame.mjs) as the inferred causing_commit.
//
// With `force` (the queue calls it before each job) it runs only once suite_every landings are
// due, ignores the queue and cannot be cancelled, so a busy queue never starves it.
//
// `runSuite(cfg, { fileBug, pollMs, force })` → null (not due) | { sha, status, cancelled?, filed? }.
// `suiteState(cfg)` → { lastRun, lastGreen, filed }.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivedUntrackedBlocks } from './blocks.mjs';
import { brokerPaths } from './config.mjs';
import { fileBugViaCap } from './deferred.mjs';
import { checkoutState, git, lockFiles, revParse } from './git.mjs';
import { recordRun } from './health-store.mjs';
import { guardLocks } from './preimage.mjs';
import { listQueue, logPathFor } from './result.mjs';
import { runCancellable } from './run-cancellable.mjs';
import { failingTargets, landingsIn, suspects } from './suite-blame.mjs';

const dir = (cfg) => join(brokerPaths(cfg).home, 'suite');
const stateFile = (cfg) => join(dir(cfg), 'state.json');
const short = (sha) => (sha ? sha.slice(0, 7) : '-');

export function suiteState(cfg) {
  try { return JSON.parse(readFileSync(stateFile(cfg), 'utf8')); } catch { return { lastRun: null, lastGreen: null, filed: {} }; }
}
const save = (cfg, state) => { mkdirSync(dir(cfg), { recursive: true }); writeFileSync(stateFile(cfg), JSON.stringify(state, null, 2)); };

const landingsSince = (cwd, base, head) => Number(git(['rev-list', '--count', `${base}..${head}`], cwd).out);

// Idle: any new HEAD is worth a run. Forced: only once suite_every landings have accumulated
// since the last run (or since the cadence first saw this checkout).
function due(cfg, cwd, state, head, force) {
  if (!head || head === state.lastRun) return false;
  const base = state.lastRun || state.since;
  if (!base) return !force;
  const count = landingsSince(cwd, base, head);
  return !Number.isFinite(count) || count >= cfg.suiteEvery;
}

function regressionText(head, state, failing, landings, blamed, logs) {
  const tests = failing.map((f) => `${f.test}${f.spec ? ` (${f.spec})` : ''}`).join(', ');
  const range = state.lastGreen ? `${short(state.lastGreen)}..${short(head)} (${landings.length} landing(s))` : `up to ${short(head)} (no green suite run recorded yet)`;
  const likely = blamed.length
    ? `likely causing_commit ${short(blamed[0].sha)} "${blamed[0].subject}" (provenance: inferred, ${blamed[0].why})${blamed.length > 1 ? `; other suspects ${blamed.slice(1).map((b) => short(b.sha)).join(', ')}` : ''}`
    : 'no landing in the range maps to the failing targets';
  return `full suite red at ${short(head)}: failing ${tests}; range ${range}; ${likely}; logs ${logs.join(', ')}`;
}

export function runSuite(cfg, { fileBug = fileBugViaCap, pollMs, force = false } = {}) {
  if (cfg.landGate !== 'affected' || (!force && listQueue(cfg).length)) return null;
  const cwd = cfg.root;
  const state = suiteState(cfg);
  const head = revParse(cwd, 'HEAD');
  if (!state.lastRun && !state.since && head) save(cfg, { ...state, since: head });
  if (!due(cfg, cwd, state, head, force)) return null;
  const untrackedBlocks = (cfg.untrackedDerived && derivedUntrackedBlocks(cwd)) || cfg.untrackedBlocks;
  if (!checkoutState(cwd, { untrackedBlocks, dirtyBlocks: cfg.dirtyBlocks }).clean) return null;

  const id = `suite-${short(head)}`;
  const startedAt = new Date().toISOString();
  const commands = [];
  for (let n = 0; n < cfg.suite.length; n++) {
    const logPath = logPathFor(cfg, id, n);
    const run = guardLocks(cfg, { id, cwd }, () => runCancellable(cfg.suite[n], { cwd, targetDir: cfg.targetDir, logPath, jobs: cfg.jobs }, { shouldCancel: () => !force && listQueue(cfg).length > 0, pollMs }));
    if (run.cancelled) return { sha: head, status: 'cancelled', cancelled: true };
    commands.push({ cmd: run.cmd, exit: run.exit, durationMs: run.durationMs, log: logPath });
  }
  recordRun(cfg, { id, repo: 'suite', kind: 'suite', startedAt, entries: lockFiles(cwd).map((path) => ({ path, blob: null })) });

  const red = commands.filter((c) => c.exit !== 0);
  const failing = red.flatMap((c) => failingTargets(readFileSync(c.log, 'utf8')));
  const status = red.length ? 'failed' : 'passed';
  const out = { sha: head, status, startedAt, finishedAt: new Date().toISOString(), commands, failing, filed: null };
  if (red.length) {
    const key = failing.map((f) => f.test).sort().join(' ') || red.map((c) => c.cmd).join(' | ');
    const landings = landingsIn(cwd, state.lastGreen, head);
    const blamed = suspects(cwd, landings, failing);
    out.suspects = blamed;
    if (!state.filed[key]) {
      fileBug({ cwd, type: 'regression', text: regressionText(head, state, failing, landings, blamed, red.map((c) => c.log)) });
      state.filed[key] = head;
      out.filed = key;
    }
  } else {
    state.lastGreen = head;
    state.filed = {};
  }
  state.lastRun = head;
  mkdirSync(dir(cfg), { recursive: true });
  writeFileSync(join(dir(cfg), `${head}.json`), JSON.stringify(out, null, 2));
  save(cfg, state);
  return out;
}

/** One status line for `broker status` / orient; null when the cadence is off. */
export function suiteLine(cfg) {
  if (cfg.landGate !== 'affected') return null;
  const s = suiteState(cfg);
  const red = Object.keys(s.filed || {}).length;
  return `suite: last run ${short(s.lastRun)}, last green ${short(s.lastGreen)}${red ? `, RED (${red} regression filed)` : ''}; every ${cfg.suiteEvery} landing(s)`;
}
