// suite.mjs — the full-suite schedule (KIT-T472, KIT-D110). With `land_gate: affected` landings skip the
// full suite; the daemon runs `suite` (default verify_default), then the `nightly:` tiers, on the committed HEAD when the
// queue is idle: once a day after `nightly_at` (default), or, with `suite_every` set, once that many landings accumulated. A queued job in any lane
// cancels the run within one poll (it re-runs later), so a suite never delays a landing and never runs
// ahead of a job (KIT-T504). A suite put off `suite_max_landings` landings or `suite_max_hours` is
// reported OVERDUE by `suiteLine` and still waits for an empty queue.
// Commands that finished before a cancel are kept per sha (`state.partial`) and not re-run while
// HEAD stays put. The tree is never checked out or rewritten: a hand-edited build path skips the
// run, and Cargo.lock is restored afterwards.
//
// A submodule lane with a `suite:` of its own (rapid-game `npm run check:all`) runs that on the
// submodule's HEAD under the same cadence, state and regression filing, in the lane's own broker home.
// Idle means every lane of the checkout: a queued job in any lane cancels the run (lane-busy.mjs).
//
// Each run writes `<broker home>/suite/<sha>.json`. A red run files ONE `cap regression` per set
// of failing tests, naming the range since the last green run, the failing tests, and the
// landings whose paths map to the failing targets (suite-blame.mjs) as the inferred causing_commit.
//
// `runSuite(cfg, { fileBug, pollMs })` → null (not due) | { sha, status, cancelled?, starved?, filed? }.
// `suiteState(cfg)` → { lastRun, lastGreen, filed }.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stopRequested } from './control.mjs';
import { derivedUntrackedBlocks } from './blocks.mjs';
import { dirtyBlocksOf } from './build-inputs.mjs';
import { brokerPaths } from './config.mjs';
import { fileBugViaCap } from './deferred.mjs';
import { checkoutState, git, lockFiles, revParse } from './git.mjs';
import { recordRun } from './health-store.mjs';
import { laneBusy } from './lane-busy.mjs';
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

// The latest nightly slot (today's `nightly_at` local time, else yesterday's) that is not in the future.
export function nightlySlot(cfg, now) {
  const slot = new Date(now);
  slot.setHours(cfg.nightlyAt.hour, cfg.nightlyAt.minute, 0, 0);
  if (slot.getTime() > now) slot.setDate(slot.getDate() - 1);
  return slot.getTime();
}

// Nightly schedule (KIT-D110): due once per slot, and only for a HEAD the last run did not cover.
const nightlyDue = (cfg, state, now) => Date.parse(state.lastRunAt || state.sinceAt || 0) < nightlySlot(cfg, now);

// Cadence schedule: any new HEAD is worth a run once suite_every landings have accumulated since the last run (or
// since the cadence first saw this checkout).
function due(cfg, cwd, state, head, now) {
  if (!head || head === state.lastRun) return false;
  if (cfg.suiteSchedule === 'nightly') return nightlyDue(cfg, state, now);
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
    : landings.length
      ? `no landing in the range maps to the failing targets; landings in the range: ${landings.slice(-5).map((l) => `${short(l.sha)} "${l.subject}"`).join(', ')}`
      : 'no landing in the range maps to the failing targets';
  return `full suite red at ${short(head)}: failing ${tests}; range ${range}; ${likely}; logs ${logs.join(', ')}`;
}

// Record when a due suite was first put off.
function notePutOff(cfg, state, head, now) {
  if (state.putOff) return;
  state.putOff = { sha: head, at: new Date(now).toISOString() };
  save(cfg, state);
}

// True once a put-off suite has waited past the landing or hour bound.
function overdue(cfg, cwd, state, head, now) {
  if (!state.putOff) return false;
  const landings = landingsSince(cwd, state.putOff.sha, head);
  return landings >= cfg.suiteMaxLandings || now - Date.parse(state.putOff.at) >= cfg.suiteMaxHours * 3600_000;
}

// What this daemon's suite covers: the root lane's `suite` over the checkout (under land_gate: affected), or a
// submodule lane's own `suite:` over that submodule; null when the cadence is off here.
function suiteScope(cfg) {
  if (!cfg.lane) return cfg.landGate === 'affected' ? { cwd: cfg.root, suite: cfg.suite, parts: cfg.suitePartitions } : null;
  const own = cfg.repos.find((r) => r.submodule && r.name === cfg.lane);
  return own && own.suite.length ? { cwd: join(cfg.root, own.path), suite: own.suite, parts: 1 } : null;
}

export function runSuite(cfg, { fileBug = fileBugViaCap, pollMs, now = Date.now() } = {}) {
  const scope = suiteScope(cfg);
  if (!scope || stopRequested(cfg)) return null;
  const cwd = scope.cwd;
  const state = suiteState(cfg);
  const head = revParse(cwd, 'HEAD');
  if (!state.lastRun && !state.since && head) {
    save(cfg, { ...state, since: head, sinceAt: new Date(now).toISOString() });
    if (cfg.suiteSchedule === 'nightly') state.sinceAt = new Date(now).toISOString();
  }
  if (!due(cfg, cwd, state, head, now)) return null;
  if (listQueue(cfg).length > 0) { notePutOff(cfg, state, head, now); return null; }
  const untrackedBlocks = (cfg.untrackedDerived && derivedUntrackedBlocks(cwd)) || cfg.untrackedBlocks;
  if (!checkoutState(cwd, { untrackedBlocks, dirtyBlocks: dirtyBlocksOf(cfg, cwd) }).clean) return null;

  const parts = scope.parts;
  const k = Math.min(state.shard || 1, parts);
  const tag = parts > 1 ? `-p${k}` : '';
  const suite = [...shardCommands(scope.suite, k, parts), ...(cfg.suiteSchedule === 'nightly' && !cfg.lane ? cfg.nightly : [])];
  const id = `suite-${short(head)}${tag}`;
  const startedAt = new Date().toISOString();
  const kept = state.partial && state.partial.id === id ? state.partial.commands : [];
  const commands = [];
  for (let n = 0; n < suite.length; n++) {
    const logPath = logPathFor(cfg, id, n);
    if (kept[n] && kept[n].cmd === suite[n].trim()) { commands.push(kept[n]); continue; }
    const run = guardLocks(cfg, { id, cwd }, () => runCancellable(suite[n], { cwd, targetDir: cfg.targetDir, logPath, jobs: cfg.jobs, testThreads: cfg.testThreads }, { shouldCancel: () => !!laneBusy(cfg) || stopRequested(cfg), pollMs }));
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
  state.lastRunAt = new Date(now).toISOString();
  delete state.partial;
  delete state.putOff;
  state.shard = nextShard(k, parts);
  mkdirSync(dir(cfg), { recursive: true });
  writeFileSync(join(dir(cfg), `${head}${tag}.json`), JSON.stringify(out, null, 2));
  save(cfg, state);
  return out;
}

/** One status line for `broker status` / orient; null when the cadence is off. */
export function suiteLine(cfg, now = Date.now()) {
  const scope = suiteScope(cfg);
  if (!scope) return null;
  const s = suiteState(cfg);
  const red = Object.keys(s.filed || {}).length;
  const late = overdue(cfg, scope.cwd, s, revParse(scope.cwd, 'HEAD'), now) ? `, OVERDUE (put off since ${s.putOff.at.slice(0, 16)}Z; runs when the queue is empty)` : '';
  return `suite: last run ${short(s.lastRun)}, last green ${short(s.lastGreen)}${red ? `, RED (${red} regression filed)` : ''}${late}; ${cfg.suiteSchedule === 'nightly' ? `nightly after ${cfg.nightlyAt.text}${cfg.lane ? '' : ` (${cfg.nightly.length} extra tier command(s))`}` : `every ${cfg.suiteEvery} landing(s)`}${scope.parts > 1 ? `, partition ${s.shard || 1}/${scope.parts} next` : ''}`;
}
