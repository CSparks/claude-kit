// pipeline-config.mjs — the landing-gate and suite-cadence keys of the `broker:` section (KIT-T472).
//
//   land_gate: full              # full (default): the job's commands as given; affected: check + mapped tests
//   affected:
//     check: cargo check --workspace --all-targets   # compile every target of the workspace
//     test: cargo test                               # prefix for the mapped `-p <crate> --test …` run
//   suite: [ "cargo test", … ]   # the full suite run on the cadence; default verify_default
//   suite_every: 1               # landings between suite runs (the suite runs when the queue is idle)
//
// `pipelineConfig(broker, verifyDefault)` → { landGate, affected: { check, test }, suite, suiteEvery }.

const DEFAULT_CHECK = 'cargo check --workspace --all-targets';
const DEFAULT_TEST = 'cargo test';

export function pipelineConfig(broker, verifyDefault) {
  const a = broker.affected && typeof broker.affected === 'object' ? broker.affected : {};
  const every = Number(broker.suite_every);
  return {
    landGate: broker.land_gate === 'affected' ? 'affected' : 'full',
    affected: { check: String(a.check || DEFAULT_CHECK), test: String(a.test || DEFAULT_TEST) },
    suite: Array.isArray(broker.suite) && broker.suite.length ? broker.suite.map(String) : verifyDefault.slice(),
    suiteEvery: Number.isFinite(every) && every >= 1 ? Math.floor(every) : 1,
  };
}
