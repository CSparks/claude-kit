---
id: KIT-T1262
title: source-shell gate (delete rule) misfire: a PowerShell command that read a temp file through the TEMP environment variable, then ran git stat
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T13:38:02Z
updated: 2026-11-15T14:04:32Z
---

## Description
source-shell gate (delete rule) misfire: a PowerShell command that read a temp file through the TEMP environment variable, then ran git status --short on a folder, was BLOCKED as a shell command deleting source by hand, reason: a git call outside the allow-list with a PowerShell environment change in the same command. Nothing was deleted or changed: git status is read-only and the environment variable was only read, not assigned. Wanted: reading an environment variable is not an environment change (only an assignment is); read-only git verbs (status, log, diff, show, ls-tree, merge-base, rev-parse) never fall under the delete rule whatever precedes them in the command. Seen in road-generator, main thread, 2026-11-15.

kit-bug-shape: cap:bug:source-shell-gate-delete-rule-misfire-a-powershe:8e8f67be
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 3ab6625 (runtime 3ab6625). hooks/lib/git-call-policy.mjs: only an assignment ($env:X =, ${env:X} =, Set/New/Remove-Item on Env:, SetEnvironmentVariable, export) is an environment change; reading $env:TEMP, Get-ChildItem Env: or GetEnvironmentVariable is not. A read-only verb (status, log, diff, show, ls-tree, ls-files, merge-base, rev-parse, rev-list, cat-file, show-ref, describe, shortlog) is exempt from the environment-change rules unless the change names GIT_*, PATH, PAGER, HOME, XDG_CONFIG_HOME or USERPROFILE (those can wrap git itself); an env prefix in front of git still refuses. Tests: hooks/git-call-environment.test.mjs 10 passed (also from the export). hooks/source-shell-gate-discard.test.mjs: the set -a case now uses a writing verb; the machine was too loaded to finish the whole file inside the 170 s limit (an earlier run, 269 passed, failed only that case, which is fixed), so a quiet-machine run of that file is still owed: node hooks/source-shell-gate-discard.test.mjs.
Security review of 3ab6625, three findings, all closed in dcfc12a (runtime dcfc12a). (1) Parser differential: the read-only exemption tested name spellings. Closed: hooks/lib/env-change.mjs parses every change to a literal variable name or null (Env:\ drive path, -Name argument, variable, concatenation, quoting, non-literal SetEnvironmentVariable all parse to null) and git-call-policy exempts a read-only verb only when every change has a literal name on HARMLESS_ENV_NAMES; a null name refuses. (2) EXPORTS narrowing missed assignment forms. Closed: any Env: reference outside Get-Item/Get-ChildItem/Get-Content/Test-Path and gi/gci/ls/dir/gc/cat is a change (so si, ni, ri, cli, rni, cpi, mi, Set-/Add-/Clear-Content, Set-Location, Remove-/Rename-Item refuse); a drive read counts only in a segment with no assignment, grouping or -*Variable parameter and a pipeline ending in a harmless sink (so Get-Item Env:X | Set-Item and ForEach { Set-Item } refuse); a $env: token is a read only when no assignment operator, comma (multiple assignment) or ++/-- follows; [Environment] is a read only as ::GetEnvironmentVariable(s)(. (3) Denylist: removed; HARMLESS_ENV_NAMES ships empty, so nothing is exempt today (the read-only verb exemption of 3ab6625 is, in effect, withdrawn; only the original misfire stays fixed: a plain read of $env:TEMP before git status passes). Known residual, pre-existing and not widened: a drive path built by string concatenation with no literal Env: or $env: in the text. Tests: hooks/git-call-environment.test.mjs 14 checks over every bypass form (each refused) and the misfire (passes), mutation-checked four ways (assignment parse, drive read, sink check, allow-list); hooks/source-shell-gate-discard.test.mjs 264 passed, 0 failed.

## History
- [2026-11-15 13:38] (created) bug — source-shell gate (delete rule) misfire: a PowerShell command that read a temp file through the TEMP environment variable, then ran git stat
- [2026-11-15 14:03] (landed) 3ab6625 The git allow-list counts only an assignment as an environment change, and a read-only verb is exempt unless the change
- [2026-11-15 14:04] (status) todo → review
- [2026-11-15 14:17] (landed) dcfc12a The git allow-list reads environment changes fail-closed: only a plain read of $env:NAME is no change, every other form 
