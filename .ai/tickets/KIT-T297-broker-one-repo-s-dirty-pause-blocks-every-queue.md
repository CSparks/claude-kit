---
id: KIT-T297
title: broker: one repo's dirty pause blocks every queued job, including jobs for a different, clean repo. A rapid-game job (j-murp8h3f-r9z85z) sat
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T01:23:23Z
updated: 2026-10-03T16:54:14Z
---

## Description
broker: one repo's dirty pause blocks every queued job, including jobs for a different, clean repo. A rapid-game job (j-murp8h3f-r9z85z) sat at queue position 2 behind a stiletto job paused on Sol's dirty crates/combat Rust, though rapid-game's checkout was clean. Pause per repo (or skip a paused jo

kit-bug-shape: cap:bug:broker-one-repo-s-dirty-pause-blocks-every-queue
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a dirty repo holds only its own queued jobs; jobs for a clean repo run past it

## Plan
1.

## History
- [2026-10-03 01:23] (created) bug — broker: one repo's dirty pause blocks every queued job, including jobs for a different, clean repo. A rapid-game job (j-murp8h3f-r9z85z) sat
- [2026-10-03 16:54] (comment) criterion added: a dirty repo holds only its own queued jobs; jobs for a clean repo run past it
- [2026-10-03 16:54] (comment) ticked: a dirty repo holds only its own queued jobs; jobs for a clean repo run past it
- [2026-10-03 16:54] (comment) @sonnet55: queue.mjs processOnce holds per repo (held map), later jobs of a held repo keep their order; broker.mjs names the held r (full comment #1 in ## Notes)
### comment #1 [2026-10-03 16:54] @sonnet55
queue.mjs processOnce holds per repo (held map), later jobs of a held repo keep their order; broker.mjs names the held repos. Tests: scripts/broker/pause-repo.test.mjs (2, incl. all-clean negative control); mutation (break on first pause) fails the clean-repo case. Broker suite 79 passed.
- [2026-10-03 16:54] (status) todo → review
