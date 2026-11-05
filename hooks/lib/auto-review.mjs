// A due recurring review is an OPEN notice (KIT-D088, KIT-D132). The SessionStart reminder tells the orchestrator the
// review is due and what its agent would do; the agent is dispatched only inside a bill of work the maintainer signs.
//
//   autoReviewDirective({ title, age, job, brief, receipt }) -> one reminder string

import { AWAITING_BILL } from './bill-of-work.mjs';

export function autoReviewDirective({ title, age, job, brief, receipt }) {
  const since = age === Infinity ? 'never run' : `${age}d since the last run`;
  return `${title} DUE (${since}) — OPEN, ${AWAITING_BILL}: raise it to the maintainer; dispatch nothing until he signs it. If signed: an agent (sonnet, [job: ${job}]). Brief: ${brief} ` +
    `The agent applies the safe part itself and raises only exceptions, one line each. Receipt: "${receipt}".`;
}
