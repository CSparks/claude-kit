---
id: KIT-T1161
title: process failure (road-generator main thread, 2026-11-13): a brief told a read-only reviewer to run cargo run in the background, which the br
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1062]
files: []
supersedes:
superseded_by:
created: 2026-11-13T22:57:07Z
updated: 2026-11-13T23:19:05Z
---

## Description
process failure (road-generator main thread, 2026-11-13): a brief told a read-only reviewer to run cargo run in the background, which the broker-wait gate (KIT-D115) refuses; the sanctioned form for a long run is to start the BUILT exe in the background and end the turn. Root cause: the orchestrator's brief text for long probe runs is written from memory. Prevention wanted: the kit's agent definitions and the dispatch guidance state the one sanctioned long-run form (build in the foreground, run the built exe in the background, end the turn), and the dispatch guard flags a brief that tells an agent to background cargo run or cargo test.

kit-bug-shape: cap:bug:process-failure-road-generator-main-thread-2026-:187b3777
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The one sanctioned long-run form (build in the foreground, start the built exe in the background, end the turn) is in docs/wait-rule.md and its 15 agent copies; the dispatch guard check background-run blocks a brief that backgrounds cargo run or cargo test, or starts it in the background, without naming the built exe (hooks/dispatch-background-run.test.mjs 15 passed incl. the built-exe negative control; 257abb2, plugin 0.1.45)

## Plan
1.

## Notes
Fix 257abb2: docs/wait-rule.md and the 15 agent definitions gain one bullet (a long run of a program is the BUILT exe started in the background after a foreground build, then end the turn; never cargo run or cargo test in the background). hooks/dispatch-background-run.mjs is a new dispatch-guard check (id background-run, listed by q gates agent): it blocks a prompt that puts cargo run or cargo test near a background word, or says start it in the background, unless the prompt names the built exe (a target/debug or target/release path, or the words built exe); a clause that forbids the form (never, do not) is skipped. Plugin 0.1.45 so sessions load the agent text (KIT-T1071). Neighbour KIT-T1062 (review). Tests: dispatch-background-run 15, dispatch-guard 46, gate-protocol 52, agent-timeout-rule 115, broker-wait-gate 88.

## History
- [2026-11-13 22:57] (created) bug — process failure (road-generator main thread, 2026-11-13): a brief told a read-only reviewer to run cargo run in the background, which the br
- [2026-11-13 23:12] (landed) 257abb2 wait rule: a long run of a program is the built exe started in the background, never cargo run or cargo test in the back
- [2026-11-13 23:18] (comment) criterion added: The one sanctioned long-run form (build in the foreground, start the built exe in the background, end the turn) is in docs/wait-rule.md and its 15 agent copies; the dispatch guard check background-run blocks a brief that backgrounds cargo run or cargo test, or starts it in the background, without naming the built exe (hooks/dispatch-background-run.test.mjs 15 passed incl. the built-exe negative control; 257abb2, plugin 0.1.45)
- [2026-11-13 23:18] (comment) ticked: The one sanctioned long-run form (build in the foreground, start the built exe in the background, end the turn) is in docs/wait-rule.md and its 15 agent copies; the dispatch guard check background-run blocks a brief that backgrounds cargo run or cargo test, or starts it in the background, without naming the built exe (hooks/dispatch-background-run.test.mjs 15 passed incl. the built-exe negative control; 257abb2, plugin 0.1.45)
- [2026-11-13 23:19] (comment) @claude: (fixed) 257abb2; dispatch-background-run.test.mjs 15 passed
- [2026-11-13 23:19] (status) todo → review
