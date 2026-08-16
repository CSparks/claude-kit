---
id: KIT-D067
title: One crate, one workspace — never a fork of shared code
date: 2026-08-15
supersedes:
source: KIT-T224 (Chris, 2026-08-06; discussed 2026-08-05 — "supposed to be codified at the KIT level")
---

**Decision:** A shared unit of code has exactly ONE home. Never create a second crate,
package, or workspace member that duplicates an existing one, and never fork shared code
to make a local change. Extend the canonical crate (feature flag, trait, parameter) or
raise the change against it; a per-consumer copy is a defect, not an isolation strategy.
A duplicate discovered in the tree is a convergence ticket, not a fact to work around.
Applies to every language's equivalent (crates/workspace members, npm packages, Python
distributions) and to vendored copies of first-party code.

**Why:** Two copies of one concern is the DRY red flag at repo scale — fixes land in one
copy, drift is silent, and the "which is canonical?" question then costs a provenance
investigation on every later touch (cf. the two-live-surfaces stop rule, KIT-T227). It was
carried per-project (stiletto D010/T115/T120 "never a fork") where each new project had to
rediscover it. Rejected: allowing a temporary fork with a convergence ticket — the ticket
outlives the deadline and the fork becomes the norm.
