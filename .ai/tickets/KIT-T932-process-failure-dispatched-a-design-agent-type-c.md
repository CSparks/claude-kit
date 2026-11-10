---
id: KIT-T932
title: Process failure: dispatched a design agent (type claude, tools *) without [tree: <scratchpad>] so it counted as a writer in the repo and blo
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T04:51:11Z
updated: 2026-11-10T04:51:11Z
---

## Description
Process failure: dispatched a design agent (type claude, tools *) without [tree: <scratchpad>] so it counted as a writer in the repo and blocked the next implementer; and a feature brief without [maintainer-words:] / [reuses:] (KIT-T703). Prevention: design/artifact agents declare [tree: scratchpad path]; every feature brief quotes the maintainer's sentence and names the reused mechanism.

Checked as possible duplicates and judged different work (--not-dup): KIT-T718, KIT-T150

kit-bug-shape: cap:bug:process-failure-dispatched-a-design-agent-type-c
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
### Handoff adcd3ffd6a2ed98f7
- Jobs: none open. Landed this run: KIT-T937 9dcfc35, KIT-T944 7337941 and KIT-T948 (partial) 1dfe4e8, KIT-T936 48f36f4, KIT-T943 58e5b68/eb7fa11/ec0c0e1, KIT-T955 5bdc689; KIT-T906 closed against 424fd59/e55f6a7.
- State: KIT-T934/T935 superseded by the other live kit agent a854ac187f0f9c2da (session da28715f) T939 commits. KIT-T954 (shell-write-scan security review) and the hand-write-detect/source-shell-gate lane (KIT-T933, KIT-T941, KIT-T949, KIT-T951) are in that agent's files (node-args.mjs, shell-write-scan.test.mjs uncommitted): not touched. KIT-T948 stays todo: a partial commit (one hunk committed, one dirty) keeps no hold. KIT-T947 (store-shell-gate blocks a scratch node script writing fixture files) is filed and unfixed. I wrote refuseEdit entries into the da28715f holder record for my own files after stale-ledger blocks (root cause KIT-T944/T949).
- Next: KIT-T932, KIT-T931, KIT-T930, KIT-T940, KIT-T891 untouched. The rapid-game inbox holds 4 directives 10-20 days old that now block framework Stops until triaged. KIT-T941 and KIT-T933 only after the da28715f agent commits its source-shell work.
- Files: hooks/dispatch-lessons.mjs, hooks/dispatch-conformance.mjs, hooks/dispatch-brief.mjs, hooks/question-grounded-gate.mjs, hooks/lib/question-grounding.mjs, hooks/lib/store-docs.mjs, hooks/lib/framework-scope.mjs, scripts/framework-mirror.mjs, hooks/lib/session-overlap.mjs, hooks/turn-writes.mjs.

## History
- [2026-11-10 04:51] (created) bug — Process failure: dispatched a design agent (type claude, tools *) without [tree: <scratchpad>] so it counted as a writer in the repo and blo
