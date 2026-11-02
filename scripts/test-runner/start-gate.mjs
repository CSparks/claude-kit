// start-gate.mjs — keeps a budgeted run inside its wall-clock budget when the plan's estimate was optimistic
// (a loaded machine, records measured at a lighter load) (KIT-T839, KIT-D104). The plan packs files into lanes by their
// recorded cost; this gate re-checks at each start against the real clock: a file is skipped when starting it would end
// past budget x SLACK. The test named for a changed module (distance 0) always starts. A skipped file is not run, so
// it rotates in on a later run, and the run reports it (a reached one becomes part of the owed remainder).
//
//   startGate({ budgetMs, cost, reached, started, now }) -> { skips(file) }
//   NO_GATE                                              -> a gate that skips nothing (a full or listed run)

const SLACK = 1.25;
const NEAREST = 0;

export const NO_GATE = { skips: () => false };

export function startGate({ budgetMs, cost, reached, started, now = Date.now }) {
  return { skips: (file) => reached.get(file) !== NEAREST && now() - started + cost(file) > budgetMs * SLACK };
}
