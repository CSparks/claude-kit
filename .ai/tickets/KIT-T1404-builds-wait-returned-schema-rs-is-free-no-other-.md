---
id: KIT-T1404
title: builds --wait returned 'schema.rs is free; no other writer's build starts on it for 90 s', yet within that window writer 4100d9bf|a763e392 s
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T23:29:36Z
updated: 2026-11-18T23:49:34Z
fixed_commit: f243b306
---

## Description
builds --wait returned 'schema.rs is free; no other writer's build starts on it for 90 s', yet within that window writer 4100d9bf|a763e392 started 'cargo check -j 4 -p road-generator --lib' (pid 51472), which compiles the same crate; the next edit batch (environment.rs etc.) was refused at 23:28:50Z. The 90 s hold seems keyed to the waited file, not the crate the build reaches, or a cargo check is not held.

kit-bug-shape: cap:bug:builds-wait-returned-schema-rs-is-free-no-other-:c08eeead
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] an edit the guard passed keeps its writer's write windows open (at least 120 s, never shorter) until it lands, and landing settles them to the edit gap, so a build start cannot take the crate while the batch is in the hooks (scripts/broker/write-window.test.mjs, hooks/build-write-hold.test.mjs)

## Plan
1.

## Notes
Reproduced from the F12 agent's transcript and road-generator's run records: `builds --wait` on schema.rs returned free at 23:27:02 and opened the 90 s FREE window. The agent then sent a batch of twelve edits; the guard (holder-beat, PreToolUse) passed the first (schema.rs) at about 23:27:08 and, treating that as landed, shortened every window of the writer to 30 s (KIT-T1219's settle). That edit then took until 23:28:49 to land (time spent in the hooks before the write), so the window had lapsed long before the rest of the batch reached the guard. run-20261118232718-fttl (`cargo check -j 4 -p road-generator --lib`, writer a763e392) was queued for cores from 23:27:18, found no window when its cores came and took the crate; environment.rs and the rest of the batch were refused from 23:28:50. Its output carries no "holding the start" line, so no window was live at its start. The window was keyed correctly (schema.rs is in road-generator, inside the build's scope); the defect was settling at guard time instead of at landing.

Fix: a passing edit no longer settles at guard time. The guard calls holdWindowsInFlight: the writer's live windows stay open at least IN_FLIGHT_S (120 s) and are never shortened. The edit's landing (PostToolUse, tool-write-record.mjs) settles them to EDIT_GAP_S as before (KIT-T1219 unchanged). A build start still waits at most START_WAIT_S (90 s) behind a window, so a writer cannot hold a crate indefinitely.

Tests: scripts/broker/write-window.test.mjs 8 pass (new: an edit in flight keeps the window past the free window, a build at +100 s yields, landing settles to one edit gap, a longer window is never shortened, no window is opened by an edit); hooks/build-write-hold.test.mjs 61 PASS (new KIT-T1404 case: after the guard passes an edit the window outlasts the free window; the KIT-T1219 cases now land the edit through tool-write-record); build-wait, broken-crates, claims-release-verb, agent-claims, claim-release, dispatch-holder, hand-write-edit-sequences 14, tool-writes-race 8, commit-staged-delete pass.

The larger problem (writers refused for 25 minutes while 5 or more long builds run) is a design proposal in KIT-T1396, not built.

## History
- [2026-11-18 23:29] (created) bug — builds --wait returned 'schema.rs is free; no other writer's build starts on it for 90 s', yet within that window writer 4100d9bf|a763e392 s
- [2026-11-18 23:48] (status) todo → doing
- [2026-11-18 23:48] (comment) criterion added: an edit the guard passed keeps its writer's write windows open (at least 120 s, never shorter) until it lands, and landing settles them to the edit gap, so a build start cannot take the crate while the batch is in the hooks (scripts/broker/write-window.test.mjs, hooks/build-write-hold.test.mjs)
- [2026-11-18 23:49] (comment) ticked: an edit the guard passed keeps its writer's write windows open (at least 120 s, never shorter) until it lands, and landing settles them to the edit gap, so a build start cannot take the crate while the batch is in the hooks (scripts/broker/write-window.test.mjs, hooks/build-write-hold.test.mjs)
- [2026-11-18 23:49] (landed) f243b306 write window: an edit the guard passed keeps its writer's windows open until it lands, and landing (PostToolUse) settles
- [2026-11-18 23:49] (status) doing → review
- [2026-11-18 23:49] (comment) runtime f243b306 published
