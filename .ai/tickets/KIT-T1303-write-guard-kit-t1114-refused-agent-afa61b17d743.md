---
id: KIT-T1303
title: write guard (KIT-T1114) refused agent afa61b17d7436d410's Edit of crates/rdg-world/tests/power_bands.rs as 'changed by agent afa61b17d7436d4
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T04:48:17Z
updated: 2026-11-16T06:36:34Z
---

## Description
write guard (KIT-T1114) refused agent afa61b17d7436d410's Edit of crates/rdg-world/tests/power_bands.rs as 'changed by agent afa61b17d7436d410 of session bf054b5b and not committed' - the SAME agent id as the writer; the agent's own earlier edits to that file passed, and its builds export CLAUDE_KIT_BUILD_WRITER=4100d9bf-...|afa61b17d7436d410 (a different session id than the tasks dir bf054b5b): own-file identity check compares session ids that disagree for one agent

kit-bug-shape: cap:bug:write-guard-kit-t1114-refused-agent-afa61b17d743:e2ec4e02
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root: a subagent's session id changes mid-life (road-generator agent af157f9edb874eaf1: transcript in session bf054b5b until 22:02, then in 4100d9bf; both dirs hold its transcript). Claims were keyed and compared as session+agent, so claims made before the change read as another writer's. Fix: agent-claims.sameWriter and the commit-time foreignClaims identify a subagent by agent id alone; the session-ledger check (live-claims.overlappingHolders) skips a file the calling agent itself holds a standing claim on (ownStandingClaim); crate-checks and live-writers compare claimants with sameWriterId. Tests: hooks/agent-claims.test.mjs (4 new, 1 fails on the old code), hooks/commit-agent-claims.test.mjs 14 passed (new case fails on the old code); session-overlap, claim-release, claim-release-controls, holder-shell-attribution, commit-gate, dispatch-holder, crate-check, claims-release-verb, broken-crates, build-write-hold, write-batch, source-shell-gate-main-thread (24), source-shell-gate-discard-live (72) exit 0. Not covered: a main thread whose own session id changes still reads its old session as another session for up to 15 minutes; build-hold writer strings compare session|agent exactly (consistent after the change, only an in-flight pre-change build differs).

## History
- [2026-11-16 04:48] (created) bug — write guard (KIT-T1114) refused agent afa61b17d7436d410's Edit of crates/rdg-world/tests/power_bands.rs as 'changed by agent afa61b17d7436d4
- [2026-11-16 06:36] (status) todo → review
