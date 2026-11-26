---
id: KIT-T1601
title: upstream-gate push-drift (KIT-T1447) judges the wrong repo: a PowerShell command 'Set-Location D:/dev/claude-kit; ...; git push origin main'
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T06:00:53Z
updated: 2026-11-26T06:17:28Z
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

## History
- [2026-11-26 06:00] (created) bug — upstream-gate push-drift (KIT-T1447) judges the wrong repo: a PowerShell command 'Set-Location D:/dev/claude-kit; ...; git push origin main'
- [2026-11-26 06:16] (landed) 13b83133 upstream-gate: a push after Set-Location, sl, pushd or Push-Location (popd and Pop-Location return) is judged in the rep
- [2026-11-26 06:17] (comment) @claude: (fixed) 13b83133; push-drift 29 pass (4 failed before); runtime 13b83133
- [2026-11-26 06:17] (status) todo → review
