// pipeline-config.mjs — the landing-gate and suite-cadence keys of the `broker:` section (KIT-T472).
//
//   land_gate: full              # full (default): the job's commands as given; affected: check + mapped tests
//   affected:
//     check: cargo check --workspace --all-targets   # compile every target of the workspace
//     test: cargo test                               # prefix for the mapped `-p <crate> --test …` run
//     match: word                                    # word (default) | module: how a src module finds the tests naming it (affected-match.mjs)
//     mandatory: false                               # true: the affected set runs even when the job gave its own --test commands
//   suite: [ "cargo test", … ]   # the full suite run on the cadence; default verify_default
//   suite_every: 1               # landings between suite runs; once due it runs before the next job
//   suite_max_landings: 10       # a suite put off this many landings runs its next unfinished command between jobs (suite.mjs)
//   suite_max_hours: 2           # ... or this many hours
//   suite_partitions: 1          # >1: each suite run covers one rotating partition (suite-shard.mjs)
//   runner: cargo                # cargo (default) | nextest: a job's per-target cargo tests run as one nextest run
//   batch: 8                     # most queued disjoint jobs one build carries (train.mjs); 1 runs every job alone
//   incremental_keep_hours: 24   # after a suite run, drop incremental caches unused this long (incremental.mjs); off disables
//
// `pipelineConfig(broker, verifyDefault)` → { landGate, affected: { check, test, match, mandatory }, suite, suiteEvery, suitePartitions, runner, batch }.

const DEFAULT_CHECK = 'cargo check --workspace --all-targets';
const DEFAULT_TEST = 'cargo test';
const DEFAULT_BATCH = 8;
const KEEP_HOURS = 24;
const positive = (v, dflt) => (Number.isFinite(Number(v)) && v !== '' && v != null && Number(v) > 0 ? Number(v) : dflt);

export function pipelineConfig(broker, verifyDefault) {
  const a = broker.affected && typeof broker.affected === 'object' ? broker.affected : {};
  const every = Number(broker.suite_every);
  return {
    landGate: broker.land_gate === 'affected' ? 'affected' : 'full',
    affected: { check: String(a.check || DEFAULT_CHECK), test: String(a.test || DEFAULT_TEST), match: a.match === 'module' ? 'module' : 'word', mandatory: a.mandatory === true },
    suite: Array.isArray(broker.suite) && broker.suite.length ? broker.suite.map(String) : verifyDefault.slice(),
    suiteEvery: Number.isFinite(every) && every >= 1 ? Math.floor(every) : 1,
    suiteMaxLandings: Math.floor(positive(broker.suite_max_landings, 10)),
    suiteMaxHours: positive(broker.suite_max_hours, 2),
    suitePartitions: Number.isInteger(Number(broker.suite_partitions)) && Number(broker.suite_partitions) > 1 ? Number(broker.suite_partitions) : 1,
    runner: broker.runner === 'nextest' ? 'nextest' : 'cargo',
    incrementalKeepHours: broker.incremental_keep_hours === 'off' || broker.incremental_keep_hours === false ? null
      : Number.isFinite(Number(broker.incremental_keep_hours)) && broker.incremental_keep_hours !== '' && broker.incremental_keep_hours != null ? Number(broker.incremental_keep_hours) : KEEP_HOURS,
    batch: Number.isInteger(Number(broker.batch)) && Number(broker.batch) >= 1 ? Number(broker.batch) : DEFAULT_BATCH,
  };
}
