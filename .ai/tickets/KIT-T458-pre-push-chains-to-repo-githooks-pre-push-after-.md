---
id: KIT-T458
title: pre-push chains to <repo>/.githooks/pre-push after LFS
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T20:40:58Z
updated: 2026-10-13T22:28:22Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T200
### comment #2 [2026-10-14 16:14] @claude
DEFECT (stiletto 2026-10-14 ~11:12): the chain fails open when git cannot set up the work tree. The stiletto rapid-game submodule gitdir was at core.bare=true plus core.worktree (a test leaked GIT_DIR inside the hook, RG-T036#15). In that state the kit pre-push found no toplevel and pushed cdf70ab6..17688c7d to origin in 3 s without running <repo>/.githooks/pre-push. Wanted: when the repo hook cannot be located, or git rev-parse --show-toplevel fails in a repo whose tracked tree has .githooks/pre-push, refuse the push (exit 1) and print the repair (git --git-dir=<gitdir> config core.bare false). Test: a submodule-style gitdir with bare=true plus worktree, and a red repo hook -> pre-push exits 1.

## History
- [2026-10-13 20:40] (created) feature — pre-push chains to <repo>/.githooks/pre-push after LFS
- [2026-10-13 22:28] (comment) @claude: (fixed) 94ef352. Test evidence: scripts/pre-push-chain.test.mjs 13 passed; mutation: dropping the chain fails 5; npm test green
- [2026-10-13 22:28] (status) todo → review
- [2026-10-14 16:14] (comment) @claude: DEFECT (stiletto 2026-10-14 ~11:12): the chain fails open when git cannot set up the work tree. The stiletto rapid-game  (full comment #2 in ## Notes)
