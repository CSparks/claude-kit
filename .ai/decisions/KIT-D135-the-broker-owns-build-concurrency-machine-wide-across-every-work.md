---
id: KIT-D135
title: The broker owns build concurrency machine-wide, across every workspace; no two projects' builds may run unthrottled together
summary: The broker gates Rust build concurrency machine-wide across every project, always leaving at least 2 of the 16 cores free; C++ revisited if still a problem
date: 2026-11-07
supersedes: 
source: Chris 2026-11-07, stiletto-2349 session
revised: 2026-11-07
---


**Status:** accepted
**Decided by:** Chris

**Decision:** The broker is responsible for build concurrency across the whole machine. It already controls multiple writers inside one repo; it must also refuse to let concurrent builds in ANY workspace run the way they did on 2026-11-07. At least 2 cores always stay free of building: this is a 16-core machine, so the machine-wide build budget is at most 14 cores, never sized as if it had 32. The controller applies to ALL projects. First pass covers Rust builds only (cargo, rustc, cargo-nextest, cargo-ndk); C++ builds (GrooveGrid) do not chew comparable CPU and are out of scope for now, with room left to add them. A machine-wide compile controller covers every project, agent and build tool (cargo, rustc, nextest, cargo-ndk).

**Maintainer:** "There needs to be a system wide controller of ALL fucking compiling tasks in the kit, because holy fuck. The system should never become this fucking unresponsive. This smells like a broker bug."
"I don't think that's very weak actually, The problem is that while the broker should be controlling multiple writes in the same repo, we need a system wide responsibility for the broker to NOT let concurrent builds in ANY workspace run like that."
"The freeze was more than likely caused by whatever that clusterfuck was."
"There should always be at least 2 cores (this is a 16 core machine, not 32) not utilized for building."
"ANd that needs to be across ALL projects. Rust or C++"
"Though GrooveGrid builds really don't chew as much CPU as Rust, so just rust for now."
"We'll revisit if it is still a problem."

**Why:** On 2026-11-07 the game froze between the load screen and gameplay and then showed a wide stretch of brown ground. A snapshot taken during the spike showed a PixelVision cargo-ndk release build and a Dirt Empire `cargo test -j 15` running together with 16 of 64 GB RAM free, after a Stiletto `cargo t` (build.jobs 24) and a 15-25 minute pre-push gate. Broker lanes are per repo, so nothing coordinated them.

**How to apply:** Build KIT feature for a machine-wide job-slot budget (CPU and commit-limit memory), with queueing or throttling instead of simultaneous `-j 15` and `-j 24`, priority for a running game or UAT session, and a visible readout of who is building. A kit agent builds it only inside a bill Chris signs.

**Rejected:** Per-repo broker lanes as the only concurrency control.
