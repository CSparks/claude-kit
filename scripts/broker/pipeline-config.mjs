// pipeline-config.mjs — the landing-gate and suite-cadence keys of the `broker:` section (KIT-T472).
//
//   land_gate: affected          # affected (default, KIT-D110): check of every target + the tests the changed paths map to, their dependents included; full: the job's commands as given
//   affected:
//     check: cargo check --workspace --all-targets   # compile every target of the workspace; the gate runs it with the features `test` uses, and a check feature the tests lack runs with the suite (gate-check.mjs)
//     test: cargo test                               # prefix for the mapped `-p <crate> --test …` run
//     match: word                                    # word (default) | module: how a src module finds the tests naming it (affected-match.mjs)
//     dependents: true                               # false: skip the tests of the touched crates' reverse dependencies (Cargo.lock) in the landing gate
//     mandatory: false                               # true: the affected set runs even when the job gave its own --test commands
//     conformance: cargo t -p game --test conformance   # the framework conformance test (rg-testkit); joins every landing that touches .rs or .toml (landgate.mjs)
//   pin_test_args: ["-P", "pin"]   # appended to an auto-pin's test run (pin-scope.mjs): e.g. a nextest profile without the GPU group
//   suite: [ "cargo test", … ]   # the full suite run on the cadence; default verify_default
//   suite_every: 10              # opt out of the nightly slot: run the suite every N landings (once due it runs when the queue is idle)
//   nightly_at: "02:00"          # default schedule (KIT-D110): the suite runs once a day after this local time, when the queue is idle
//   nightly: [ "cargo t -P render -j 1", "cargo t -P perf -j 4" ]   # GPU, golden and performance tiers, run after the suite in the nightly slot
//   suite_max_landings: 10       # a suite put off this many landings runs its next unfinished command between jobs (suite.mjs)
//   suite_max_hours: 2           # ... or this many hours
//   suite_partitions: 1          # >1: each suite run covers one rotating partition (suite-shard.mjs)
//   runner: cargo                # cargo (default) | nextest: a job's per-target cargo tests run as one nextest run
//   check_tree: true             # check runs happen in a broker-owned git worktree, so the live checkout holds landed code only (check-tree.mjs); false: the live tree
//   precheck: true               # submit runs a fast compile check of the patch (affected.check) in its own tree and target dir before the job takes a queue slot (precheck.mjs); false: off
//   precheck_timeout_s: 90       # a precheck past this fails open (the job queues) and leaves its progress in the persistent target dir for the next one
//   batch: 8                     # most queued disjoint jobs one build carries (train.mjs); 1 runs every job alone
//   batch_window_s: 0            # >0: a lone trainable job waits up to this long for a peer while 2+ sessions are active (batch-window.mjs); 0 (default) off
//   incremental_keep_hours: 24   # after a suite run, drop incremental caches unused this long (incremental.mjs); off disables
//
// `pipelineConfig(broker, verifyDefault, env)` → { landGate, affected: { check, test, match, mandatory, dependents, conformance }, suiteSchedule, nightlyAt, nightly, suite, suiteEvery, suitePartitions, runner, batch, batchWindowMs, precheck, precheckTimeoutMs }.

import { aliasOf } from './alias.mjs';
import { gateChecks } from './gate-check.mjs';

const DEFAULT_CHECK = 'cargo check --workspace --all-targets';
const DEFAULT_TEST = 'cargo test';
const DEFAULT_BATCH = 8;
const KEEP_HOURS = 24;
const DEFAULT_BATCH_WINDOW_S = 0;
const DEFAULT_PRECHECK_TIMEOUT_S = 90;
const MS_PER_S = 1000;
const positive = (v, dflt) => (Number.isFinite(Number(v)) && v !== '' && v != null && Number(v) > 0 ? Number(v) : dflt);

const NIGHTLY_AT = '02:00';
const CLOCK = /^(\d{1,2}):(\d{2})$/;
const HOURS_MAX = 23;
const MINUTES_MAX = 59;

// The pre-KIT-D110 defaults (full landing gate, landing-count suite cadence); the cargo-free test fixtures set this.
const legacyDefaults = (env) => !!env.BROKER_LEGACY_DEFAULTS;

function nightlyAt(value) {
  const m = CLOCK.exec(String(value == null ? NIGHTLY_AT : value).trim()) || CLOCK.exec(NIGHTLY_AT);
  const hour = Math.min(Number(m[1]), HOURS_MAX);
  const minute = Math.min(Number(m[2]), MINUTES_MAX);
  return { hour, minute, text: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

export function pipelineConfig(broker, verifyDefault, env = process.env, root = null) {
  const a = broker.affected && typeof broker.affected === 'object' ? broker.affected : {};
  const test = String(a.test || DEFAULT_TEST);
  const { gate, scheduled } = gateChecks(String(a.check || DEFAULT_CHECK), test, (prefix) => (root ? aliasOf(prefix, root) : null));
  const every = Number(broker.suite_every);
  return {
    landGate: broker.land_gate === 'full' || (broker.land_gate !== 'affected' && legacyDefaults(env)) ? 'full' : 'affected',
    affected: { check: gate, fullCheck: String(a.check || DEFAULT_CHECK), test, match: a.match === 'module' ? 'module' : 'word', mandatory: a.mandatory === true, dependents: a.dependents !== false, conformance: a.conformance ? String(a.conformance) : null },
    suiteSchedule: (broker.suite_every != null && broker.suite_every !== '') || legacyDefaults(env) ? 'cadence' : 'nightly',
    scheduledChecks: scheduled,
    nightlyAt: nightlyAt(broker.nightly_at),
    nightly: [].concat(broker.nightly == null ? [] : broker.nightly).map(String).filter(Boolean),
    pinTestArgs: [].concat(broker.pin_test_args == null ? [] : broker.pin_test_args).map(String).filter(Boolean),
    suite: Array.isArray(broker.suite) && broker.suite.length ? broker.suite.map(String) : verifyDefault.slice(),
    suiteEvery: Number.isFinite(every) && every >= 1 ? Math.floor(every) : 1,
    suiteMaxLandings: Math.floor(positive(broker.suite_max_landings, 10)),
    suiteMaxHours: positive(broker.suite_max_hours, 2),
    suitePartitions: Number.isInteger(Number(broker.suite_partitions)) && Number(broker.suite_partitions) > 1 ? Number(broker.suite_partitions) : 1,
    runner: broker.runner === 'nextest' ? 'nextest' : 'cargo',
    incrementalKeepHours: broker.incremental_keep_hours === 'off' || broker.incremental_keep_hours === false ? null
      : Number.isFinite(Number(broker.incremental_keep_hours)) && broker.incremental_keep_hours !== '' && broker.incremental_keep_hours != null ? Number(broker.incremental_keep_hours) : KEEP_HOURS,
    batchWindowMs: (Number.isFinite(Number(broker.batch_window_s)) && broker.batch_window_s !== '' && broker.batch_window_s != null && Number(broker.batch_window_s) >= 0 ? Number(broker.batch_window_s) : DEFAULT_BATCH_WINDOW_S) * MS_PER_S,
    checkTree: broker.check_tree === false || (broker.check_tree == null && legacyDefaults(env)) ? false : true,
    precheck: broker.precheck === false || (broker.precheck == null && legacyDefaults(env)) ? false : true,
    precheckTimeoutMs: positive(broker.precheck_timeout_s, DEFAULT_PRECHECK_TIMEOUT_S) * MS_PER_S,
    batch: Number.isInteger(Number(broker.batch)) && Number(broker.batch) >= 1 ? Number(broker.batch) : DEFAULT_BATCH,
  };
}
