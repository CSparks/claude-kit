---
id: KIT-T799
title: claude-kit commit 91541d9 (pushed, 13:44 2026-11-01) is titled 'fix: billboards face the camera square-on under rotated parents (implements
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:45:18Z
updated: 2026-11-01T19:48:09Z
---

## Description
claude-kit commit 91541d9 (pushed, 13:44 2026-11-01) is titled 'fix: billboards face the camera square-on under rotated parents (implements MAR-T035)', a marblequest ticket, but it holds only kit hook work for KIT-T785/T784/T711 (broker-wait-gate, inert-heredoc, command-leads, data-command, shell-segments, query-gate and tests) plus kit tickets. The commit gate accepted a foreign project's ticket id as the work reference in the claude-kit repo. A commit's cited ticket key must belong to the repo's own store (or a registered submodule's)

kit-bug-shape: cap:bug:claude-kit-commit-91541d9-pushed-13-44-2026-11-0
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x]
- [x] A foreign-key-only code commit blocks naming the expected key; own key and touched-submodule key pass (hooks/commit-cite-keys.test.mjs)

## Plan
1.

## Notes
Provenance: 91541d9 is the marblequest-18 session's kit agent work on KIT-T785, KIT-T784 and KIT-T711 (broker-wait-gate, inert-heredoc, command-leads, data-command, shell-segments, query-gate, tests, kit tickets). Its title (implements MAR-T035) is wrong: the agent reused a scratchpad commit-message file holding MAR-T035 text; the real MAR-T035 fix is marblequest 22a34d6. Pushed, not rewritten. The gate let it through because the commit touched kit tickets (plan-of-record early-allow ran before any key check). Fix: hooks/lib/commit-cite-keys.mjs, judged in hooks/commit-gate.mjs before the early-allow. Tests: hooks/commit-cite-keys.test.mjs (8 passed), commit-gate.test.mjs (42 passed).

## History
- [2026-11-01 19:45] (created) bug — claude-kit commit 91541d9 (pushed, 13:44 2026-11-01) is titled 'fix: billboards face the camera square-on under rotated parents (implements
- [2026-11-01 19:45] (status) todo → doing
- [2026-11-01 19:48] (comment) ticked:
- [2026-11-01 19:48] (comment) criterion added: A foreign-key-only code commit blocks naming the expected key; own key and touched-submodule key pass (hooks/commit-cite-keys.test.mjs)
- [2026-11-01 19:48] (comment) ticked: A foreign-key-only code commit blocks naming the expected key; own key and touched-submodule key pass (hooks/commit-cite-keys.test.mjs)
- [2026-11-01 19:48] (status) doing → review
