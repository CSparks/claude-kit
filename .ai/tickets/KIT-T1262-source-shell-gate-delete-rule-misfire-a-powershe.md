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

## History
- [2026-11-15 13:38] (created) bug — source-shell gate (delete rule) misfire: a PowerShell command that read a temp file through the TEMP environment variable, then ran git stat
- [2026-11-15 14:03] (landed) 3ab6625 The git allow-list counts only an assignment as an environment change, and a read-only verb is exempt unless the change
- [2026-11-15 14:04] (status) todo → review
