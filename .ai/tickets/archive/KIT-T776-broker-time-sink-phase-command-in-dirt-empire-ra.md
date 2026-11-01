---
id: KIT-T776
title: broker time sink: phase command in dirt-empire/rapid-game
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T777
superseded_by:
created: 2026-11-01T15:36:58Z
updated: 2026-11-01T19:27:24Z
---

## Description
phase command in dirt-empire/rapid-game: 10.6 min, 44% of its phase time, 1.8 min/job, worse (+24% per job), #3 (was #8)

kit-bug-shape: broker-blocker:dirt-empire|rapid-game|phase|command
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-01 15:36] (created) bug — broker time sink: phase command in dirt-empire/rapid-game
- [2026-11-01 15:51] (comment) @kit-agent: kit-agent diagnosis 2026-11-01: the rapid-game lane runs "cd rust && cargo t -p <crate> --lib", which the project alias  (full comment #1 in ## Notes)
### comment #1 [2026-11-01 15:51] @kit-agent
kit-agent diagnosis 2026-11-01: the rapid-game lane runs "cd rust && cargo t -p <crate> --lib", which the project alias composes to cargo nextest run --workspace --features rg-engine/dynamic_linking -E package(<crate>). The alias needs --workspace for feature unification, so each job compiles every workspace test binary (nextest: 42 tests run, 111 binaries skipped). rapid-game workspace members already build at opt-level 1 (rust/Cargo.toml), so the dev fast tier is not the cause here. Recorded jobs: cold 152 s (j-mvwm08kh-hzp093), warm 44 s (j-mvwm48j5-d0cphx). The +987% per job is DE-T264 and DE-T226 editing rg-meshkit-bevy repeatedly in the window (it was rank 18). 1.2 to 1.8 min per job is under the KIT-D104 5-minute ceiling; the flag is a ranking, not a breach. Possible lever, not built because of feature-unification risk: scope the alias to -p <crate> plus the feature owner.
- [2026-11-01 15:51] (status) todo → doing
- [2026-11-01 16:36] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 16:36] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 19:27] (comment) @claude: Chris 2026-11-01 via questionnaire: close as ranking, not a defect. Jobs run 44 s warm, 152 s cold, under the KIT-D104 ceiling.
- [2026-11-01 19:27] (status) doing → done (human)
