---
id: KIT-T1081
title: shell-variables.mjs SHELL_REBINDERS (KIT-T1080, cefdede) fails open: (1) PowerShell module-qualified cmdlet, e.g. Microsoft.PowerShell.Utili
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T20:54:30Z
updated: 2026-11-11T21:03:17Z
---

## Description
shell-variables.mjs SHELL_REBINDERS (KIT-T1080, cefdede) fails open: (1) PowerShell module-qualified cmdlet, e.g. Microsoft.PowerShell.Utility\Set-Variable, escapes WHOLE_WORD because the preceding backslash is treated as a path separator; (2) bash escaped builtin after an unquoted expansion, e.g. $IFS\source f and $IFS\eval ..., escapes the (?<!PATH_BEFORE\) lookbehind. Fix: strip a module qualifier before the boundary check (or keep \b for cmdlets); treat a backslash/word char after an unquoted $NAME/${..}/$digit expansion as a command boundary or fail closed on any unquoted expansion in command position; add tests for both.

kit-bug-shape: cap:bug:shell-variables-mjs-shell-rebinders-kit-t1080-ce
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 20:54] (created) bug — shell-variables.mjs SHELL_REBINDERS (KIT-T1080, cefdede) fails open: (1) PowerShell module-qualified cmdlet, e.g. Microsoft.PowerShell.Utili
- [2026-11-11 21:02] (comment) @claude: Fix: shell-variables.mjs splits SHELL_REBINDERS into BUILTIN_WORDS (path-joined by a path char + backslash unless that c (full comment #1 in ## Notes)
### comment #1 [2026-11-11 21:02] @claude
Fix: shell-variables.mjs splits SHELL_REBINDERS into BUILTIN_WORDS (path-joined by a path char + backslash unless that char ends an unquoted $NAME expansion) and CMDLET_WORDS (no backslash exemption, so a module qualifier no longer hides Set/New/Clear/Remove-Variable). Rule stated: an extensionless path ending in a cmdlet name stays fail-closed; src\Set-Variable.cpp (a file with an extension) passes. Tests: new hooks/shell-rebinder-qualifiers.test.mjs 23 passed; source-shell-gate-wrapped 238, source-shell-gate 168, -escapes 11, -delete 19, store-shell-gate 52 on a git archive export; 6 mutations killed (scratchpad t1081-mutate.mjs). Handoff kit-agent-T1081: Jobs: fix. State: done, nothing open. Next: none. Files: hooks/lib/shell-variables.mjs, hooks/shell-rebinder-qualifiers.test.mjs.
- [2026-11-11 21:03] (landed) 38d1311 shell-variables: a PowerShell module-qualified cmdlet and a bash builtin escaped after an unquoted expansion stay rebind
- [2026-11-11 21:03] (status) todo → review
