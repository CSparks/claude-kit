---
id: KIT-D110
title: Tests are tiered in every project: a landing runs only the crates it touched plus their dependents; GPU, golden and performance tiers and the full suite run nightly
summary: Promotes ST-D254 and ST-D255 from Stiletto to the kit. The broker default for every project is land_gate affected (compile all targets, tests of the touched crates and their dependents, no GPU tier) plus a nightly scheduled suite with the heavy tiers; a project opts out explicitly. Troubleshooting runs are narrow and named.
date: 2026-10-29
supersedes: 
source: Chris 2026-10-29: 'tests need to NIGHTLY, not every change unless troubleshooting and THEN they need to be compartmentalized. WHY doesn't this pattern transfer over?'; ST-D254 and ST-D255 (Stiletto), ST-T926, KIT-D093, KIT-D104
---


**Decision:** (promotes ST-D254, ST-D255; extends KIT-D093)
1. A landing runs only what it touched: compile every target of the workspace, plus the tests of the crates its paths map to and their dependents (Cargo.lock reverse dependencies). The default test profile holds no GPU, golden or performance tier.
2. The GPU, golden and performance tiers run nightly, or when a render crate changes. A red files a ticket naming the causing commit; the performance tier reports its timings so creep stays visible but is not a gate.
3. The full suite runs nightly on the committed HEAD, not on a landing cadence.
4. A troubleshooting run is narrow and named: one test, one binary or one crate, never the suite.
5. Broker default for every project: `land_gate: affected`, `affected.dependents: true`, and a nightly slot (`nightly_at`, default 02:00 local) that runs `suite` followed by the project's `nightly:` commands (the GPU, golden and perf tiers). A project opts out by writing `land_gate: full` or `suite_every: N` (landing cadence) in its broker config.
6. A project keeps its slow and GPU tests out of its default test profile (Stiletto: nextest `render` and `perf` profiles, default excludes exactly those; guard test in the project).

**Why:** a 116-minute full run per landing, 18 hours for ten unrelated patches (Stiletto), and the same pattern re-hit in dirt-empire because the decision lived only in Stiletto's store. Chris 2026-10-21: "WHY ... CAN'T TESTS BE MORE COMPARTMENTALIZED SO THAT WE CAN STILL HAVE TESTS THAT DON'T TAKE ALL ... DAY?!"

**Rejected:** a full suite per landing or per pin; keeping GPU tests in the default profile; a project-by-project rediscovery of the tiering.

**Keeps:** the KIT-D104 five-minute ceiling for a routine job; the green cache and the known-red handling.
