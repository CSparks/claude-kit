---
id: KIT-T532
title: Kit npm test red at 45d4937 (2026-10-15, run by stiletto-2349-2a, log in its scratchpad kit-npm-test.log; the run hit the 30-min tool limit): 5 broker failures. 4 are git fixture setup failures, not assertions: 'git init' failed in 66 ms (pin.test.mjs:144 via subkit.mjs:16), 'git submodule add' clone of a temp bare repo failed (pin.test.mjs:131; temp paths mix CHRISS~1 and 'Chris Sparks'), 'git hash-object -w' failed (linked.test.mjs:151), pin-stale.test.mjs:77 frameworkCommit read null.sha (setup returned no commit). 1 assertion: batch.test.mjs:148 'batch 1 builds once per job' 3 !== 4. Suspects: machine load from a live broker, 8.3 short-name vs long temp paths, temp exhaustion; and the suite exceeds 30 min
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T20:48:23Z
updated: 2026-10-15T20:48:23Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T515, KIT-T519, KIT-T482

## History
- [2026-10-15 20:48] (created) bug — Kit npm test red at 45d4937 (2026-10-15, run by stiletto-2349-2a, log in its scratchpad kit-npm-test.log; the run hit the 30-min tool limit): 5 broker failures. 4 are git fixture setup failures, not assertions: 'git init' failed in 66 ms (pin.test.mjs:144 via subkit.mjs:16), 'git submodule add' clone of a temp bare repo failed (pin.test.mjs:131; temp paths mix CHRISS~1 and 'Chris Sparks'), 'git hash-object -w' failed (linked.test.mjs:151), pin-stale.test.mjs:77 frameworkCommit read null.sha (setup returned no commit). 1 assertion: batch.test.mjs:148 'batch 1 builds once per job' 3 !== 4. Suspects: machine load from a live broker, 8.3 short-name vs long temp paths, temp exhaustion; and the suite exceeds 30 min
