# The data repo's git contract is operator-facing only — sessions learn it by accident

Chris asked (2026-08-04, stiletto session): "Is Claude Kit doing a good job of outlining
how to maintain claude-kit-data from a git perspective?" Grounded answer: the mechanism
is solid, the agent-facing outline is missing.

## Evidence (lived, same session)
- The per-project CLAUDE.md that `init-project` appends describes the whole `.ai/`
  workflow but never states `.ai` is a junction into a separate repo, that `sync-data`
  auto-commits it at Stop, or any manual-commit etiquette. The session learned the
  dual-repo layout only from orient's "data repo (.ai)" line.
- Consequence: the session hand-committed the data repo (`cd .ai && git add -A`) —
  repo-wide add swept `projects/jollys-vinyl/agents.jsonl` into a stiletto-labeled
  commit ("capture: ST-T047 UAT ...", acb7547 in claude-kit-data). The Stop hook would
  have done the same add under the honest generic message; the hand commit was both
  redundant ceremony AND mislabeled cross-project churn.

## Proposed fix (small)
`init-project`'s CLAUDE.md template gains a short **"Data repo (git)"** section:
1. `.ai` resolves into `claude-kit-data` (centralized mode, KIT-D008); the project repo
   ignores it — that separation is what keeps workflow chatter out of public repos.
2. `sync-data` auto-commits + pushes it at Stop — do NOT hand-commit as ceremony.
3. If a hand commit is ever warranted, scope the pathspec to `projects/<this-project>/`
   or keep the generic `sync: workflow data` message — never a project-labeled message
   over a repo-wide `add -A`.
4. On a reported PUSH FAILED, the runbook is: `git -C <data> pull --rebase && git -C
   <data> push`, never force.
Related: KIT-T143 (split-brain reconcile, still todo) covers the de-adoption drift path;
consider an orient warning when a previously-centralized project's `.ai` stops resolving
into the data repo.
