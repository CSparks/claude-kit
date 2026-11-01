---
id: KIT-T780
title: broker time sink: crate rg-physics in dirt-empire/root
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T781
superseded_by:
created: 2026-11-01T15:37:00Z
updated: 2026-11-01T23:12:46Z
---

## Description
crate rg-physics in dirt-empire/root: 4.1 min, 11% of its crate time, 0.4 min/job, worse (+95% per job), #3 (was #7)

kit-bug-shape: broker-blocker:dirt-empire|root|crate|rg-physics
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Measured: crate rg-physics in dirt-empire/root is 0.5 min per 24 h (better -94%), rank #13, 1% of crate time: below the lane ticket's materiality line; the rebuild share is the shared-target edit/revert residue accounted in aafd799. Listed in KIT-T816 only if material again.

## History
- [2026-11-01 15:37] (created) bug — broker time sink: crate rg-physics in dirt-empire/root
- [2026-11-01 15:51] (comment) @kit-agent: kit-agent diagnosis 2026-11-01: rg-physics is a path dependency of the dirt-empire root; its Cargo.toml has no per-crate (full comment #1 in ## Notes)
### comment #1 [2026-11-01 15:51] @kit-agent
kit-agent diagnosis 2026-11-01: rg-physics is a path dependency of the dirt-empire root; its Cargo.toml has no per-crate [profile.dev.package] sections for rg-* crates (framework-profile.mjs --root D:/dev/dirt-empire: 68 missing), so every rg-physics source change (cargo dirty reason: source changed src/wheeled/mod.rs) rebuilds at opt-level 3 through the "*" rule. Kit side is built (orient FRAMEWORK DEV PROFILE flag KIT-T690 f88e581; rapid-game scripts/dev-profile.mjs --write; rg_testkit conformance guard). Owning home is dirt-empire DE-T209 (live; fast-tier groups of ten crates per check job, 58 crates remain; DE-INBOX-2026-10-30-2001 holds tests/framework_conformance and broker.affected.conformance). No kit change to land here; the dirt-empire session finishes the groups.
- [2026-11-01 15:51] (status) todo → doing
- [2026-11-01 16:36] (comment) seen again in dirt-empire: crate rg-physics in dirt-empire/root: 4.1 min, 16% of its crate time, 0.5 min/job, worse (+161% per job), #3 (was #7)
- [2026-11-01 19:32] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 23:12] (status) doing → review
