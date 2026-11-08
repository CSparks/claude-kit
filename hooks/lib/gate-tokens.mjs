// gate-tokens — the one definition of every tag a gate accepts (KIT-T898, KIT-D147). A gate matches `pattern`;
// `q gates <gate>` prints `form` and `meaning`; hooks/gate-tokens.test.mjs proves each form satisfies its pattern, so
// the printout and the gate cannot drift. Tags go in the prompt of the gated call unless a gate says otherwise.
//
//   TOKENS.<key>.{ name, form, meaning, pattern }

const token = (name, form, meaning, pattern) => ({ name, form, meaning, pattern });

export const TOKENS = {
  job: token('job', '[job: fix]', 'the capability-table job this delegation serves (prompt or description; an agent definition may carry a default)', /\[job:\s*([\w-]+)\s*\]/i),
  modelOverride: token('model-override', '[model-override: <reason>]', 'run a model outside the job row on purpose; the reason is logged on the roster row', /\[model-override:\s*([^\]\s][^\]]*)\]/i),
  allowFable: token('allow-fable', '[allow-fable: <reason>]', 'keep a deliberate model-less fable inherit', /\[allow-fable\b/i),
  escalate: token('escalate', '[escalate: <reason>]', 'a job dearer than the ticket type default (a failed first pass, spatial work, a regression)', /\[escalate:\s*([^\]\s][^\]]*)\]/i),
  readOnly: token('read-only', '[read-only: <reason>]', 'a writer-capable agent type used for research only', /\[read-only:\s*([^\]\s][^\]]*)\]/i),
  tree: token('tree', '[tree: <absolute path>]', 'the checkout this agent writes in, when it is not the session checkout', /\[tree:\s*([^\]]+)\]/i),
  paths: token('paths', '[paths: a.rs, b.md]', 'the repo-relative files a patch worker will patch', /\[paths:\s*([^\]]+)\]/i),
  pathsUnknown: token('paths: *', '[paths: *]', 'the files are unknown; serialises this worker against every other worker', /\[paths:\s*\*\s*\]/i),
  maintainerParallel: token('maintainer-asked-parallel', '[maintainer-asked-parallel: <his words>]', 'a second writer in one checkout, only on the maintainer\'s quoted words', /\[maintainer-asked-parallel:\s*[^\]\s][^\]]*\]/i),
  maintainerWorktree: token('maintainer-asked-worktree', '[maintainer-asked-worktree: <his words>]', 'a worktree dispatch, only on the maintainer\'s quoted words', /\[maintainer-asked-worktree:\s*[^\]\s][^\]]*\]/i),
  lessonsChecked: token('lessons-checked', '[lessons-checked: L-R01, L-S02]', 'rendering, performance, asset or streaming work cites the framework lessons it checked, or `[lessons-checked: none apply: <why>]`', /\[lessons-checked:\s*([^\]]*)\]/i),
  conformanceNotAffected: token('conformance', '[conformance: not affected: <why>]', 'the work cannot move a framework default; otherwise the brief names the conformance test', /\[conformance:\s*not affected\b[:\s-]*\S[^\]]*\]/i),
  uiFrameworkChecked: token('ui-framework-checked', '[ui-framework-checked: <rg-ui mechanism reused, or why none applies>]', 'UI sizing or layout work states the framework mechanism it reuses', /\[ui-framework-checked:\s*[^\]\s][^\]]*\]/i),
  maintainerWords: token('maintainer-words', '[maintainer-words: "<his sentence>"]', 'a feature or request brief quotes the maintainer', /\[maintainer-words:\s*[^\]\s][^\]]*\]/i),
  reuses: token('reuses', '[reuses: <existing mechanism>]', 'a variant of an existing feature names what it reuses, or `[reuses: none: <why>]`', /\[reuses:\s*[^\]\s][^\]]*\]/i),
  handoffWaived: token('handoff-waived', '[handoff-waived: <reason>]', 'replace a past-ceiling agent although it wrote no handoff (only when the handoff is impossible)', /\[handoff-waived:\s*[^\]\s][^\]]*\]/i),
  writeHandoff: token('write-handoff', '[write-handoff]', 'the one message a past-ceiling agent is resumed with: its handoff request', /\[write-handoff\]/i),
  reAsk: token('re-ask', '[re-ask: <reason>]', 'ask a question another session already asked and nobody resolved (in the question text)', /\[re-ask:\s*[^\]]+\]/i),
};
