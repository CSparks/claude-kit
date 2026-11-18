---
id: KIT-T1408
title: builds --wait said rg-buildings/src/roofs.rs 'free, no other writer's build starts on it for 90s', yet writer ad8d8672fd47d1a7a's cargo test
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T23:49:04Z
updated: 2026-11-18T23:54:13Z
---

## Description
builds --wait said rg-buildings/src/roofs.rs 'free, no other writer's build starts on it for 90s', yet writer ad8d8672fd47d1a7a's cargo test -p rg-townplan (pid 54448) started 5 s later and refused the rest of a multi-file batch after two edits had landed, leaving the crate half edited (roofs.rs referencing types its caller did not yet match). The 90 s hold covers the waited file only, not the crate the batch spans, and the batch marker does not stop a new build starting on files already edited. Need: the post-wait hold covers every file of the crate (or the writer's declared batch) and holds new builds off until the batch's last edit.

kit-bug-shape: cap:bug:builds-wait-said-rg-buildings-src-roofs-rs-free-:ee421096
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a started batch keeps its writer's crate hold (and its dependents' builds) until it lands or 120 s from its first edit, across files, and a build start waits up to 150 s for it; builds --wait states this (scripts/broker/write-window.test.mjs)

## Plan
1.

## Notes
Same code path as KIT-T1404 (scripts/broker/write-window.mjs). Folded in:

- A window already holds a crate, not one file: a build waits while a window's file lies in its scope, and a build's scope is its packages with their dependency closure (cargo-scope-dirs.mjs), so `cargo test -p rg-townplan` waits on a window over rg-buildings/src/roofs.rs. What let the build in was time: the window was settled when the guard passed an edit (fixed in KIT-T1404: kept open while the edit is in flight, settled when it lands) and a build start waited at most 90 s.
- A started batch now keeps its hold until it lands or BATCH_MAX_S (120 s) from its first edit passes: holdWindowsInFlight records batchStart on the writer's windows and extends them no further than batchStart + 120 s; a file the batch adds (settleWindows) joins the same batchStart, so chaining files cannot stretch the hold.
- A build start waits START_WAIT_S = BATCH_MAX_S + EDIT_GAP_S (150 s, was 90 s) behind a window: long enough for a started batch to land and settle, never longer.
- `builds --wait` now says what it holds: for 90 s no other writer's build of this crate or of a crate depending on it starts, and once the batch's first edit passes the hold lasts until the batch has landed, at most 120 s from that edit; it tells the writer to send the whole batch at once.

Tests: scripts/broker/write-window.test.mjs 9 pass (new: a second file joins the batch, a build at +100 s yields, no extension past 120 s from the first edit, the start wait covers a batch plus one edit gap); build-wait, build-write-hold (all PASS), build-run, build-slot pass.

The broader writer-starvation design (free a crate once the running build compiled it; reservations) stays a proposal in KIT-T1396.

## History
- [2026-11-18 23:49] (created) bug — builds --wait said rg-buildings/src/roofs.rs 'free, no other writer's build starts on it for 90s', yet writer ad8d8672fd47d1a7a's cargo test
- [2026-11-18 23:54] (status) todo → doing
- [2026-11-18 23:54] (comment) criterion added: a started batch keeps its writer's crate hold (and its dependents' builds) until it lands or 120 s from its first edit, across files, and a build start waits up to 150 s for it; builds --wait states this (scripts/broker/write-window.test.mjs)
- [2026-11-18 23:54] (comment) ticked: a started batch keeps its writer's crate hold (and its dependents' builds) until it lands or 120 s from its first edit, across files, and a build start waits up to 150 s for it; builds --wait states this (scripts/broker/write-window.test.mjs)
