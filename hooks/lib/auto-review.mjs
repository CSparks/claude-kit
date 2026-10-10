// A due recurring review is an agent dispatch, not a nag (KIT-D088). The SessionStart reminder
// tells the orchestrator to dispatch the agent now; the agent applies the safe part itself and
// raises only exceptions, one line each.
//
//   autoReviewDirective({ title, age, job, brief, receipt }) -> one reminder string

export function autoReviewDirective({ title, age, job, brief, receipt }) {
  const since = age === Infinity ? 'never run' : `${age}d since the last run`;
  return `${title} DUE (${since}) — DISPATCH NOW, do not ask: an agent (sonnet, [job: ${job}]). Brief: ${brief} ` +
    `Apply the safe part yourself; raise to the maintainer ONLY an exception, one line each. Receipt: "${receipt}".`;
}
