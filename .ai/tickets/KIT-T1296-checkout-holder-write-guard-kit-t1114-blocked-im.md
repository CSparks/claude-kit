---
id: KIT-T1296
title: checkout-holder write guard (KIT-T1114) blocked implementer agent aafa85a735dc98a6a's Edit of crates/road-generator/tests/ground_seams.rs na
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T04:09:47Z
updated: 2026-11-16T06:36:29Z
---

## Description
checkout-holder write guard (KIT-T1114) blocked implementer agent aafa85a735dc98a6a's Edit of crates/road-generator/tests/ground_seams.rs naming agent aafa85a735dc98a6a as the other writer: the only uncommitted change in the file was that agent's own earlier Edit (one line), and its first Edit of the same file had passed; three parallel Edits in one message were all refused. Own-file check misfired when the hold belongs to the same agent id (parallel tool calls?).

kit-bug-shape: cap:bug:checkout-holder-write-guard-kit-t1114-blocked-im:2173ef63
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root: a subagent's session id changes mid-life (road-generator agent af157f9edb874eaf1: transcript in session bf054b5b until 22:02, then in 4100d9bf; both dirs hold its transcript). Claims were keyed and compared as session+agent, so claims made before the change read as another writer's. Fix: agent-claims.sameWriter and the commit-time foreignClaims identify a subagent by agent id alone; the session-ledger check (live-claims.overlappingHolders) skips a file the calling agent itself holds a standing claim on (ownStandingClaim); crate-checks and live-writers compare claimants with sameWriterId. Tests: hooks/agent-claims.test.mjs (4 new, 1 fails on the old code), hooks/commit-agent-claims.test.mjs 14 passed (new case fails on the old code); session-overlap, claim-release, claim-release-controls, holder-shell-attribution, commit-gate, dispatch-holder, crate-check, claims-release-verb, broken-crates, build-write-hold, write-batch, source-shell-gate-main-thread (24), source-shell-gate-discard-live (72) exit 0. Not covered: a main thread whose own session id changes still reads its old session as another session for up to 15 minutes; build-hold writer strings compare session|agent exactly (consistent after the change, only an in-flight pre-change build differs).

## History
- [2026-11-16 04:09] (created) bug — checkout-holder write guard (KIT-T1114) blocked implementer agent aafa85a735dc98a6a's Edit of crates/road-generator/tests/ground_seams.rs na
- [2026-11-16 06:36] (status) todo → review
