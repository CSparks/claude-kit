---
id: KIT-T1601
title: upstream-gate push-drift (KIT-T1447) judges the wrong repo: a PowerShell command 'Set-Location D:/dev/claude-kit; ...; git push origin main'
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1585]
files: []
supersedes:
superseded_by:
created: 2026-11-26T06:00:53Z
updated: 2026-11-27T06:37:14Z
---

## Description
upstream-gate push-drift (KIT-T1447) judges the wrong repo: a PowerShell command 'Set-Location D:/dev/claude-kit; ...; git push origin main' run from a session whose cwd is D:/dev/road-generator was blocked for road-generator's unpinned rapid-game submodule, not claude-kit's. Root cause: the gate resolves the push's repo from the session cwd, ignoring a Set-Location/cd earlier in the same command (git -C <repo> push passed). Fix: resolve the repo from git -C, or from the last cd/Set-Location/pushd before the push in the command.

kit-bug-shape: cap:bug:upstream-gate-push-drift-kit-t1447-judges-the-wr:d542435a
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: hooks/lib/upstream-policy.mjs:99 (collectSubmissions) moved its directory only on cdTarget (hooks/lib/shell-segments.mjs:82), which reads a bash cd alone, so 'Set-Location D:/dev/claude-kit; ...; git push origin main' from a road-generator session was judged in the session cwd by push-drift, push-pin, pre-push wiring and the upstream policy alike. Landed 13b83133: new shell-segments.mjs locationMove reads cd, chdir, pushd, Set-Location, sl, Push-Location (/d, -Path, -LiteralPath, any case) and popd/Pop-Location (a stack returns the directory); used only by collectSubmissions, cdTarget's other five callers unchanged until KIT-T1585. git -C still names the repo. Test: hooks/push-drift.test.mjs 4 of 29 failed before (Set-Location both directions, set-location -Path, pushd), 29 pass; upstream-gate 44, upstream-gate-pre-push 25 pass. Runtime 13b83133.
### comment #3 [2026-11-26 07:11] @claude
(fixed) d681c499 security findings: location commands on tokens without redirections, stacks, swap and cd - modelled, unresolvable moves judge every reached directory, nested shell from its binary; push-drift 39, upstream-gate 51, pre-push 25 pass
Folded into KIT-T1585 under RDG-D191 (2026-11-27): following Set-Location, pushd or a nested shell inside a command is the class RDG-D191 reverted ('following a nested cd', KIT-T1552), and 13b83133, c6b61e51 and d681c499 drew three rounds of security findings. All three are reverted in 702e8a38; the push gates judge the session directory and a plain cd as before 13b83133. Workaround until the one-lexer job: git -C <repo> push.
Security review of the revert 702e8a38, three findings, acknowledged under RDG-D191 and left to KIT-T1585: findings 1 and 3 ask for location following back, which RDG-D191 settles. Finding 2 (scan every segment with commandRuns before handling cd, as the old code did) was checked: git diff 13b83133^ (9439a6bc) -- hooks/lib/upstream-policy.mjs hooks/upstream-gate.mjs hooks/lib/shell-segments.mjs is empty, so the restored code is byte-identical to the code before 13b83133; that code also handled a cd segment before scanning nested commands, so the finding names old behaviour, not a regression. Nothing restored, no test added. Any further finding against this code is left to KIT-T1585.

## History
- [2026-11-26 06:00] (created) bug — upstream-gate push-drift (KIT-T1447) judges the wrong repo: a PowerShell command 'Set-Location D:/dev/claude-kit; ...; git push origin main'
- [2026-11-26 06:16] (landed) 13b83133 upstream-gate: a push after Set-Location, sl, pushd or Push-Location (popd and Pop-Location return) is judged in the rep
- [2026-11-26 06:17] (comment) @claude: (fixed) 13b83133; push-drift 29 pass (4 failed before); runtime 13b83133
- [2026-11-26 06:17] (status) todo → review
- [2026-11-26 06:17] (landed) f8053925 tickets: KIT-T1601 to review (fix 13b83133); KIT-T1593 remedy text landed 9439a6bc, the ended-writer lift and stash pari
- [2026-11-26 06:22] (landed) c6b61e51 upstream-gate: a location verb moves the judged repo only when the tool's shell runs it, so under Bash a push after Set-
- [2026-11-26 06:22] (comment) @claude: (fixed) c6b61e51 follow-up: location verbs count only for the tool's shell (Bash Set-Location into an owned repo no longer passes a foreign push); upstream-gate 48 pass; runtime c6b61e51
- [2026-11-26 06:22] (landed) 3c2ca763 tickets: KIT-T1601 follow-up fix c6b61e51 recorded, runtime c6b61e51 (implements KIT-T1601)
- [2026-11-26 07:11] (landed) d681c499 upstream-gate: location commands are read on tokens and a nested command takes the shell that launches it; a move the ga
- [2026-11-26 07:11] (comment) @claude: (fixed) d681c499 security findings: location commands on tokens without redirections, stacks, swap and cd - modelled, un (full comment #3 in ## Notes)
- [2026-11-26 07:11] (landed) e4148505 tickets: KIT-T1601 security-finding fix d681c499 recorded (implements KIT-T1601)
- [2026-11-27 06:37] (landed) 702e8a38 upstream-gate: revert the location following of 13b83133, c6b61e51 and d681c499; the push gates judge the session direct
- [2026-11-27 06:37] (status) review → todo
- [2026-11-27 06:37] (comment) remaining after 7 landed commit(s): the push gates following Set-Location, pushd and nested shells, built in the one-lexer job KIT-T1585 under RDG-D191; until then git -C <repo> push
