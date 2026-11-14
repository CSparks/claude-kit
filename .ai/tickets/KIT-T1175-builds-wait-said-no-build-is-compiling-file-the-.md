---
id: KIT-T1175
title: builds --wait said 'no build is compiling <file>; the edit passes now' while a cargo build that reaches the file's crate was already running
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-14T01:18:54Z
updated: 2026-11-14T01:47:10Z
---

## Description
builds --wait said 'no build is compiling <file>; the edit passes now' while a cargo build that reaches the file's crate was already running (pid 20668, cargo test -p road-generator --test structure_census --no-run; the checkout-holder gate refused the next Write and reported that build as 69 s old). The wait should hold while any running build's dependency closure reaches the crate, even before cargo gets to that crate; seen from a subagent in road-generator on rapid-game/rust/world/rg-terrain/src/volume/seed/raise.rs, 2026-11-13

kit-bug-shape: cap:bug:builds-wait-said-no-build-is-compiling-file-the-:4b9b57fd
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A free builds --wait is followed by an accepted edit unless a new build started in between, and the refusal then says so
- [x] A build start yields up to 20 s to another writer's pending edit on its scope

## Plan
1.

## Notes
Cause: the wait and the hold gate share compilingHolds and read the same live holds, but at different moments: a hold exists only after the build computed its scope and won its cores, a hold in its test phase reads free until the next target compiles, and the wait returns at the first poll with no hold. Back-to-back builds of one writer slip into that gap between the wait and the edit; a path in MSYS form also read free in the wait. Fix 3135916: scripts/broker/write-window.mjs. The gate opens a 10 s window when it refuses an edit (noteRefusedEdit), the running wait keeps one open, a free wait leaves a 20 s window, a passing edit closes it. build-run.mjs waits up to 20 s in beforeStart (build-slot.mjs) while another writer's window covers the build scope; the build's own writer is never held. The refusal names the writer in the wait command and says whether the build started after the free wait (new) or was already running and compiled again. compilingHolds reads an MSYS path as a Windows path. Fairness: feasible in the wrapper and built (small). Evidence: scripts/broker/write-window.test.mjs 6 tests (two fake builds race one writer edit), build-wait + build-run + write-window 25 passed, hooks/build-write-hold.test.mjs 42 PASS (7 new), agent-claims, dispatch-holder pass. Runtime published 3135916. Not reproduced live: the exact moment in the report is unrecoverable; the three gaps above are the code-level differences found.

## History
- [2026-11-14 01:18] (created) bug — builds --wait said 'no build is compiling <file>; the edit passes now' while a cargo build that reaches the file's crate was already running
- [2026-11-14 01:46] (landed) 3135916 write-window: a free builds --wait binds for 20 s, a build start yields up to 20 s to another writer's pending edit, and
- [2026-11-14 01:46] (comment) criterion added: A free builds --wait is followed by an accepted edit unless a new build started in between, and the refusal then says so
- [2026-11-14 01:47] (comment) ticked: A free builds --wait is followed by an accepted edit unless a new build started in between, and the refusal then says so
- [2026-11-14 01:47] (comment) criterion added: A build start yields up to 20 s to another writer's pending edit on its scope
- [2026-11-14 01:47] (comment) ticked: A build start yields up to 20 s to another writer's pending edit on its scope
- [2026-11-14 01:47] (status) todo → review
