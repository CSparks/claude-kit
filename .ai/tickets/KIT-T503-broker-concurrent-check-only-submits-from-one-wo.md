---
id: KIT-T503
title: broker: concurrent check-only submits from one worker go stale create-exists (submit sees the in-flight run's created file as an on-disk collision)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T13:29:29Z
updated: 2026-10-15T13:29:29Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T500, KIT-T501
### comment #1 [2026-10-30 02:20] @claude
Still recurring 2026-10-30: dirt-empire j-mvucgvcl-qrgf8j and j-mvuch1bc-u0587p (rapid-game lane) both stale on create-exists for rg-physics/src/fixed_step.rs, the second a resubmit of the identical envelope. The submit precheck should apply the ops to its tree and reject create-exists (and an identical resubmit of a stale envelope) before queueing.
### comment #2 [2026-10-30 03:14] @claude
Landed in 39f8389. Finding: all six cited jobs were already rejected at submit (phase submit-dryrun, exit 1, no queue slot); the dry-run exists since KIT-T276. Added: per-op fix hints on stderr and in the stale entries, and a refusal of a byte-identical envelope that already came back stale on the same base (stale-envelope.mjs, phase submit-repeat). Tests: scripts/broker/submit-refusal.test.mjs (5 pass) plus 83 across the touched broker modules.

## History
- [2026-10-15 13:29] (created) bug — broker: concurrent check-only submits from one worker go stale create-exists (submit sees the in-flight run's created file as an on-disk collision)
- [2026-10-30 02:20] (comment) @claude: Still recurring 2026-10-30: dirt-empire j-mvucgvcl-qrgf8j and j-mvuch1bc-u0587p (rapid-game lane) both stale on create-e (full comment #1 in ## Notes)
- [2026-10-30 03:11] (landed) 39f8389 submit refuses create-exists, unmatched SEARCH and identical stale resubmits with hints; context ceiling 300k default an
- [2026-10-30 03:14] (comment) @claude: Landed in 39f8389. Finding: all six cited jobs were already rejected at submit (phase submit-dryrun, exit 1, no queue sl (full comment #2 in ## Notes)
