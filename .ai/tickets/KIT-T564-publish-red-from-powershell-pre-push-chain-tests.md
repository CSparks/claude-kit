---
id: KIT-T564
title: publish red from PowerShell: pre-push-chain tests spawned sh from PATH (absent outside Git Bash, so status null), then used PATH/Path spelling and git's cmd wrapper that put the real git-lfs ahead of the fake; run git's own sh with Git Bash's PATH order and MSYSTEM, and name error/signal in every assertion
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-18T03:35:04Z
updated: 2026-10-18T03:46:06Z
---

## Description
Publish of 625f68f from PowerShell: pre-push-chain 4 passed, 15 failed, every failure status=null. Root cause: the test launched 'sh' by name; Git Bash has it on PATH, PowerShell and cmd do not (ENOENT). Fixing that exposed three more environment gaps in the same test: env spread keeps the Path spelling so setting PATH did not reach the child; the cmd\git wrapper and a missing MSYSTEM let the real git-lfs.exe win over the fake. scripts/pre-push-chain.test.mjs now resolves git's sh, orders PATH as Git Bash does, sets MSYSTEM, and every detail string carries status, signal and error. 19 passed under both bash and the PowerShell tool.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T553
pre-push-chain.test.mjs resolves git's own sh, puts PATH in Git Bash's order with the fake git-lfs first, sets MSYSTEM, and every assertion carries status, signal and error; 19 passed under the bash tool and under the PowerShell tool
The gate run from the PowerShell environment (the coordinator's publish shape): pre-push-chain 19 passed. The same run flagged watchdog.test 'never reached pre-push gate' (a 60 s wall-clock wait under suite load): untilPhase now waits on the daemon exiting, not a clock; train-resume the same; the 30-60 s waits in crash-recovery, launch, train-window and testkit-leak widened to the event bound.

## History
- [2026-10-18 03:35] (created) bug — publish red from PowerShell: pre-push-chain tests spawned sh from PATH (absent outside Git Bash, so status null), then used PATH/Path spelling and git's cmd wrapper that put the real git-lfs ahead of the fake; run git's own sh with Git Bash's PATH order and MSYSTEM, and name error/signal in every assertion
- [2026-10-18 03:46] (status) todo → review
