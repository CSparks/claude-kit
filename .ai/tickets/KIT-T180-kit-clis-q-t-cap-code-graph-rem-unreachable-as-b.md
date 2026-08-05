---
id: KIT-T180
title: Kit CLIs (q, t, cap, code-graph, rem) unreachable as bare commands — plugin bin/ dir never shipped
type: bug
status: review
priority: high
milestone:
labels: [process-failure, tooling, install, cross-platform]
links: [KIT-T011, KIT-D013]
files:
  - bin/
supersedes:
superseded_by:
created: 2026-08-05T16:10:38Z
updated: 2026-08-05T16:14:18Z
---

## Description
PROCESS FAILURE (Chris, 2026-08-05, gridiron-blitz session): asked "what open tickets do
you see?", the agent fell back to globbing/grepping `.ai/tickets/` because `q` was not on
PATH — exactly the tedium the query layer exists to kill. The orientation hook itself
instructs bare `q open | q trail | cap | t | code-graph`, so every session inherits the
same trap.

ROOT CAUSE: the harness puts each installed plugin's `bin/` dir on the Bash tool's PATH
(`D:\dev\claude-kit\bin` is there via the dev-link junction), but the kit repo never
shipped a `bin/` directory — the bare names have no resolution target anywhere. The
scripts are invocable only as `node <kit>/scripts/<name>.mjs`, which no orientation text
teaches and no agent guesses.

Secondary gap (observed, not fixed here): the PowerShell tool's PATH does NOT get the
plugin bin injection — only Bash. Shims fix Bash + any shell whose PATH includes the dir;
PowerShell reachability is a separate question (machine PATH via bootstrap? harness?).

## Acceptance Criteria
- [x] `bin/` exists in the kit with paired shims (extensionless sh + `.cmd`) for the five
      bare-name CLIs the docs/orientation instruct: `q`, `t`, `cap`, `code-graph`, `rem`.
- [x] Shims are cross-platform per KIT-T011: sh shim resolves its own dir (no hardcoded
      paths); `.cmd` shim uses `%~dp0`; both forward all args and exit codes.
- [x] From an adopted repo's Bash tool shell, bare `q open` returns the open-items list
      (verified live in gridiron-blitz).
- [x] PowerShell gap is recorded as a follow-up (this ticket's History or a linked
      ticket), not silently dropped.

## Plan
1. Create `bin/<name>` + `bin/<name>.cmd` pairs delegating to `scripts/<name>.mjs`.
2. Mark sh shims executable via git (`update-index --chmod=+x` semantics / .gitattributes
   already normalize endings).
3. Verify `q open` + `t --help`-style invocation from gridiron-blitz Bash.
4. Commit, push; ticket → review.

## History
- [2026-08-05 16:10] (created) bug — Kit CLIs (q, t, cap, code-graph, rem) unreachable as bare commands — plugin bin/ dir never shipped
- [2026-08-05 16:11] (status) todo → doing
- [2026-08-05 16:13] (comment) ticked: `bin/` exists in the kit with paired shims (extensionless sh + `.cmd`) for the five
- [2026-08-05 16:13] (comment) ticked: Shims are cross-platform per KIT-T011: sh shim resolves its own dir (no hardcoded
- [2026-08-05 16:13] (comment) ticked: From an adopted repo's Bash tool shell, bare `q open` returns the open-items list
- [2026-08-05 16:13] (comment) ticked: PowerShell tool PATH lacks plugin-bin injection entirely — follow-up is KIT-T181 (bootstrap registers bin/ on user PATH)
- [2026-08-05 16:14] (status) doing → review
- [2026-08-05 16:14] (comment) shims live-verified: bare q open works from gridiron-blitz Bash tool shell
