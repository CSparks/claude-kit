---
id: KIT-T546
title: broker -p narrowing skips a command that starts with 'cd rust && ': the rapid-game lane ran the whole workspace (3220 and 3232 tests) for 'cd rust && cargo t -p rg-tunables'
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T15:54:32Z
updated: 2026-10-16T16:04:51Z
---

## Description
alias.mjs packageScoped read the alias from the job cwd (rapid-game root) while the alias lives in rapid-game/rust/.cargo/config.toml:12 (t = nextest run --workspace --features rg-engine/dynamic_linking), so the rewrite never fired. j-mvb3c0ya-aw958q and j-mvb3nijs-d1g3jf: 517 s and 829 s, 'Starting 3232 tests across 239 binaries', compile 19.6 s and 15.2 s. Regression-class follow-up of KIT-T516 / KIT-T527. Fix: resolve the cargo directory from a leading 'cd <dir> &&' and read aliases from there upward as cargo does. Test: alias.test.mjs 'a command that cds into the cargo workspace'.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T516, KIT-T527
### comment #1 [2026-10-16 15:54] @claude
Re-verify check (coordinator question): j-mvb3nijs-d1g3jf started 15:25:24Z, two seconds after j-mvb3cheb landed 21408868 on the rapid-game main (15:25:22Z). The check j-mvb3c0ya green record was keyed on the tree at 94b096a0, so the land correctly re-ran on the moved tree (no reusedFrom): a correct stale re-verify, not a defect. The cost was the unnarrowed workspace run.

## History
- [2026-10-16 15:54] (created) bug — broker -p narrowing skips a command that starts with 'cd rust && ': the rapid-game lane ran the whole workspace (3220 and 3232 tests) for 'cd rust && cargo t -p rg-tunables'
- [2026-10-16 15:54] (comment) @claude: Re-verify check (coordinator question): j-mvb3nijs-d1g3jf started 15:25:24Z, two seconds after j-mvb3cheb landed 2140886 (full comment #1 in ## Notes)
- [2026-10-16 16:04] (status) todo → review
