// suite.mjs — the full-suite cadence (KIT-T472). With `land_gate: affected` landings skip the
// full suite; the daemon runs `suite` (default verify_default) on the committed HEAD when the queue
// is idle and `suite_every` landings have accumulated since the last run. A queued job cancels the
// run (it re-runs later), so a light-load suite never delays a landing and never runs ahead of a job.
// Under constant load that would starve it: once a due suite has been put off `suite_max_landings`
// landings or `suite_max_hours`, each tick runs its next unfinished command between jobs, uncancelled.
// Commands that finished before a cancel are kept per sha (`state.partial`) and not re-run while
// HEAD stays put. The tree is never checked out or rewritten: a hand-edited build path skips the
// run, and Cargo.lock is restored afterwards.
//
// Each run writes `<broker home>/suite/<sha>.json`. A red run files ONE `cap regression` per set
// of failing tests, naming the range since the last green run, the failing tests, and the
// landings whose paths map to the failing targets (suite-blame.mjs) as the inferred causing_commit.
//
// `runSuite(cfg, { fileBug, pollMs })` → null (not due) | { sha, status, cancelled?, starved?, filed? }.
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
import { nextShard, shardCommands } from './suite-shard.mjs';

const dir = (cfg) => join(brokerPaths(cfg).home, 'suite');
const stateFile = (cfg) => join(dir(cfg), 'state.json');
const short = (sha) => (sha ? sha.slice(0, 7) : '-');

export function suiteState(cfg) {
  try { return JSON.parse(readFileSync(stateFile(cfg), 'utf8')); } catch { return { lastRun: null, lastGreen: null, filed: {} }; }
}
const save = (cfg, state) => { mkdirSync(dir(cfg), { recursive: true }); writeFileSync(stateFile(cfg), JSON.stringify(state, null, 2)); };

const landingsSince = (cwd, base, head) => Number(git(['rev-list', '--count', `${base}..${head}`], cwd).out);

// Any new HEAD is worth a run once suite_every landings have accumulated since the last run (or
// since the cadence first saw this checkout).
function due(cfg, cwd, state, head) {
  if (!head || head === state.lastRun) return false;
  const base = state.lastRun || state.since;
  if (!base) return true;
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

// Record when a due suite was first put off; true once it has waited past the landing or hour bound.
function starved(cfg, cwd, state, head, now) {
  if (!state.putOff) { state.putOff = { sha: head, at: new Date(now).toISOString() }; save(cfg, state); return false; }
  const landings = landingsSince(cwd, state.putOff.sha, head);
  return landings >= cfg.suiteMaxLandings || now - Date.parse(state.putOff.at) >= cfg.suiteMaxHours * 3600_000;
}

export function runSuite(cfg, { fileBug = fileBugViaCap, pollMs, now = Date.now() } = {}) {
  if (cfg.landGate !== 'affected') return null;
  const busy = listQueue(cfg).length > 0;
  const cwd = cfg.root;
  const state = suiteState(cfg);
  const head = revParse(cwd, 'HEAD');
  if (!state.lastRun && !state.since && head) save(cfg, { ...state, since: head });
  if (!due(cfg, cwd, state, head)) return null;
  if (busy && !starved(cfg, cwd, state, head, now)) return null;
  const untrackedBlocks = (cfg.untrackedDerived && derivedUntrackedBlocks(cwd)) || cfg.untrackedBlocks;
  if (!checkoutState(cwd, { untrackedBlocks, dirtyBlocks: cfg.dirtyBlocks }).clean) return null;

  const parts = cfg.suitePartitions;
  const k = Math.min(state.shard || 1, parts);
  const tag = parts > 1 ? `-p${k}` : '';
  const suite = shardCommands(cfg.suite, k, parts);
  const id = `suite-${short(head)}${tag}`;
  const startedAt = new Date().toISOString();
  const kept = state.partial && state.partial.id === id ? state.partial.commands : [];
  const commands = [];
  let ran = false;
  for (let n = 0; n < suite.length; n++) {
    const logPath = logPathFor(cfg, id, n);
    if (kept[n] && kept[n].cmd === suite[n].trim()) { commands.push(kept[n]); continue; }
    if (busy && ran) { save(cfg, { ...state, partial: { id, commands } }); return { sha: head, status: 'partial', starved: true }; }
    ran = true;
    const run = guardLocks(cfg, { id, cwd }, () => runCancellable(suite[n], { cwd, targetDir: cfg.targetDir, logPath, jobs: cfg.jobs }, { shouldCancel: () => !busy && listQueue(cfg).length > 0, pollMs }));
    if (run.cancelled) { save(cfg, { ...state, putOff: state.putOff || { sha: head, at: new Date(now).toISOString() }, partial: { id, commands } }); return { sha: head, status: 'cancelled', cancelled: true }; }
    commands.push({ cmd: run.cmd, exit: run.exit, durationMs: run.durationMs, log: logPath });
  }
  recordRun(cfg, { id, repo: 'suite', kind: 'suite', startedAt, entries: lockFiles(cwd).map((path) => ({ path, blob: null })) });

  const red = commands.filter((c) => c.exit !== 0);
  const failing = red.flatMap((c) => failingTargets(readFileSync(c.log, 'utf8')));
  const status = red.length ? 'failed' : 'passed';
  const out = { sha: head, shard: `${k}/${parts}`, status, startedAt, finishedAt: new Date().toISOString(), commands, failing, filed: null };
  const greens = state.greens || {};
  const lastGreen = parts > 1 ? greens[k] || null : state.lastGreen;
  if (red.length) {
    const key = `${k}:${failing.map((f) => f.test).sort().join(' ') || red.map((c) => c.cmd).join(' | ')}`;
    const landings = landingsIn(cwd, lastGreen, head);
    const blamed = suspects(cwd, landings, failing);
    out.suspects = blamed;
    if (!state.filed[key]) {
      fileBug({ cwd, type: 'regression', text: regressionText(head, { ...state, lastGreen }, failing, landings, blamed, red.map((c) => c.log)) });
      state.filed[key] = head;
      out.filed = key;
    }
  } else {
    state.lastGreen = head;
    state.greens = { ...greens, [k]: head };
    state.filed = Object.fromEntries(Object.entries(state.filed).filter(([f]) => !f.startsWith(`${k}:`)));
  }
  state.lastRun = head;
  delete state.partial;
  delete state.putOff;
  state.shard = nextShard(k, parts);
  mkdirSync(dir(cfg), { recursive: true });
  writeFileSync(join(dir(cfg), `${head}${tag}.json`), JSON.stringify(out, null, 2));
  save(cfg, state);
  return out;
}

/** One status line for `broker status` / orient; null when the cadence is off. */
export function suiteLine(cfg) {
  if (cfg.landGate !== 'affected') return null;
  const s = suiteState(cfg);
  const red = Object.keys(s.filed || {}).length;
  return `suite: last run ${short(s.lastRun)}, last green ${short(s.lastGreen)}${red ? `, RED (${red} regression filed)` : ''}; every ${cfg.suiteEvery} landing(s)${cfg.suitePartitions > 1 ? `, partition ${s.shard || 1}/${cfg.suitePartitions} next` : ''}`;
}
