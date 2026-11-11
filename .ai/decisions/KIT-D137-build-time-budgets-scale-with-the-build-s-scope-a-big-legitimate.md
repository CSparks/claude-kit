---
id: KIT-D137
title: Build time budgets scale with the build's scope; a big legitimate rebuild is never killed early, nothing runs unchecked past 5-10 minutes
summary: Broker time limits and the foreign-build wait depend on how much the build rebuilds; no low flat cap, but no unchecked builds past 5-10 minutes
date: 2026-11-07
supersedes: 
source: conversation 2026-11-07 (Chris)
---


**Maintainer:** "3 minute wait would have to be contingent on the scope of the build. I don't want to stop a bigger rust build that's rebuilding half it's crates from continuing to run. I don't really want to put a limit of build times that low at all, but I also don't want unchecked build times running over say 5-10 minutes."

**Decision:** The broker's build time budget and the wait for foreign cargo builds depend on the scope of the build (how many crates it rebuilds), not a flat number. A build that is legitimately rebuilding a large share of its crates keeps running; it is not killed at a low flat limit. No build runs past roughly 5-10 minutes unchecked: past that point it is checked (progress observed, reported, and either allowed to continue because it is making progress, or stopped because it is stalled or contended), never left silent and never killed blind.

**Why:** A flat 10-minute kill discards a progressing cold compile (rustc keeps nothing of a killed crate, so the retry redoes it; the dirt-empire lib and test compile takes about 430 s uncontended and passed 600 s under contention). A flat 3-minute foreign-build wait would stop or delay large legitimate rebuilds. Rejected: a flat low cap on build time; unchecked unlimited builds.

**Assistant-added:** "checked" is read as a progress check with a report, not a kill; this refines KIT-D104 (5 minute ceiling for routine operations) and KIT-D105 (the build slot as the only cross-directory wait) for builds.

## Notes
Maintainer 2026-11-07, same exchange: "It's good to contextualize what is being built and why it might be taking so long." Applied: the 5-10 minute check reports what is building (crates rebuilding, cold or warm, contending builds) and why it is slow.
Maintainer 2026-11-07, same exchange: "I just don't want processes that are hung up for half an hour over an incremental build." Applied: the check point must stop a STALLED build (no artifact or CPU progress) fast, so an incremental build never sits hung for 30 minutes; only progressing builds run long. Also asked: "maybe give it a Haiku agent to babysit, if that might help. NOT sure." Not adopted as an agent poll (KIT-D115 forbids agent polling); the broker's own check point does the watching.
Maintainer 2026-11-07, same exchange: "And the broker needs to be an air traffic controller re: system resources. It's not OK to tie up the machine with 4 builds at once." Applied: the broker meters machine resources (CPU, memory, disk, concurrent cargo/rustc builds across ALL projects and sessions, including hand-run cargo and pre-push gates) and admits builds against a machine-wide budget; no more than a small bounded number of builds run at once, the rest queue.
