---
id: KIT-T1281
title: build-budget holds a writer's OWN queued build after that writer calls builds --wait on a file the build compiles: the build log printed '[b
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T20:39:20Z
updated: 2026-11-15T20:57:32Z
---

## Description
build-budget holds a writer's OWN queued build after that writer calls builds --wait on a file the build compiles: the build log printed '[build-budget] holding the start up to 90s: another writer has an edit to .../crates/rdg-world/tests/land_audit/map.rs to land first', but the waiting writer and the build's owner were the same agent (bf054b5b|a8d1b0c649a20ed27, road-generator RDG-T084, 2026-11-15). Each further builds --wait (used as the one sanctioned foreground wait while the build sat in the budget queue) renewed the 90 s hold, so the agent's own build never started. Wanted: the hold ignores a wait made by the build's own writer, or builds --wait says 'your own build pid N is queued: this wait delays it'.

kit-bug-shape: cap:bug:build-budget-holds-a-writer-s-own-queued-build-a:1d45e0e6
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in a57d06c (runtime a57d06c). (a) Cause of the own-build hold: builds --wait without --writer opened its windows tagged with an EMPTY writer, so the build of the very same agent (writer S|agent) saw them as another writer and, per window, waited up to 90 s; each repeated wait renewed it (the build log printed another writer because the writer field was empty). Fix: the PreToolUse hook now runs a builds --wait command with CLAUDE_KIT_BUILD_WRITER set to the caller writer (hooks/lib/build-wrap.mjs, bash and PowerShell, a command that already sets it or an explicit --writer untouched) and build-wait.mjs takes its writer from that variable when --writer is absent; the windows are then the writer own and blockingWindows ignores them for that writer own build. (b) Cause of the half-landed batch: holder-beat refused only while a hold compiled the file, so edits issued later in the same message passed once the build ended. Fix: the first build-hold refusal leaves a per-writer marker on the held scope (scripts/broker/batch-refusal.mjs, 30 s); while it lives the same writer edits of build inputs in that scope are refused too (README or non-input files and other crates pass; an edit repairing the writer own broken crate passes), and the refusal says an earlier edit of the batch was refused, that a batch lands whole or not at all, and names the builds --wait that clears it; the writer wait returning free also clears the marker. The marker is a separate store from the build-start windows, so it never holds anyone build. Hook-model limit: PreToolUse sees one edit at a time, so all-or-none is the refuse-later-edits form; an edit that passed before the first refusal stays landed (edits of one message run in parallel). Tests: hooks/write-batch.test.mjs (wrap forms, wait writer from env, own build not held, other writer held, batch refusal after the build ends, other crate, other writer, README, wait clears it, lapse, new hold refuses again), mutation-checked four ways; build-write-hold (its cases now clear the marker per case), broken-crates, agent-claims, claim-release, build-wrap, build-wait, write-window all pass, no FAIL.

## History
- [2026-11-15 20:39] (created) bug — build-budget holds a writer's OWN queued build after that writer calls builds --wait on a file the build compiles: the build log printed '[b
- [2026-11-15 20:57] (landed) a57d06c An agent's own guard wait no longer holds its own build, and an edit batch to a crate is refused whole once one of its e
- [2026-11-15 20:57] (status) todo → review
