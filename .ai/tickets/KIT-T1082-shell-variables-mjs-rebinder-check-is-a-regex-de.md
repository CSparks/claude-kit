---
id: KIT-T1082
title: shell-variables.mjs rebinder check is a regex denylist and keeps failing open (KIT-T1080, T1081 follow-up, security review of 38d1311): (1)
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1081]
files: []
supersedes:
superseded_by:
created: 2026-11-11T21:05:06Z
updated: 2026-11-11T21:58:43Z
---

## Description
shell-variables.mjs rebinder check is a regex denylist and keeps failing open (KIT-T1080, T1081 follow-up, security review of 38d1311): (1) PowerShell aliases sv|set|nv|clv|rv and variable: provider paths (Set-Item/New-Item/Remove-Item/Clear-Item variable:) and ${name} / $scope:name assignments rebind a variable undetected; (2) bash words whose quoting defeats the regex (e.g. e'v'al, \eval, quoted source) and declare/typeset/local -n and arithmetic contexts rebind undetected. Root cause: denylist of rebinder words. Fix: invert to an allowlist, resolve a variable only when every other segment of the command is a known-safe command, anything unrecognised fails closed; dequote each command word (shellTokens/dequoted) before matching.

kit-bug-shape: cap:bug:shell-variables-mjs-rebinder-check-is-a-regex-de
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] every PowerShell alias, variable: provider write, braced or scoped assignment and common-parameter binding fails closed
- [x] every bash quote-split or escaped builtin, nameref, arithmetic and substitution form fails closed
- [x] a variable resolves only when every segment is a known-safe command; SHELL_REBINDERS and its helpers are deleted
- [x] filename operands named source/eval/Set-Variable and the cp-into-scratch positives still resolve and pass
- [x] mutation controls kill every allowlist guard

## Plan
1.

## Notes
Fix a4dfb6f (pushed), runtime a4dfb6f published. shell-variables.mjs: SHELL_REBINDERS, WHOLE_WORD, BUILTIN_WORDS, CMDLET_WORDS, DOT_COMMAND and the loop/read/printf branches of writesTo are deleted. assignedValues resolves a variable only when the shape rule holds (one literal assignment in an earlier unconditional segment, the only write to the name) AND leavesVariablesAlone is true for every segment: blank, a literal assignment (never IFS), or a command whose word, after dequoting, is on SAFE_COMMANDS (cp copy copy-item mv move-item install mkdir md echo cd set-location ls dir get-childitem pwd true test; bash case-sensitive, PowerShell case-insensitive; path-qualified, variable-named, alias and function words are not listed) and whose text has no substitution, process substitution, arithmetic, ${NAME:=x}, array subscript (bash) or parenthesis, brace, splat, variable: provider, -OutVariable/-ErrorVariable/-WarningVariable/-InformationVariable/-PipelineVariable parameter incl. aliases, prefixes and dash variants (PowerShell). Ambiguous quoting resolves nothing. PWD, OLDPWD, RANDOM, SECONDS, LINENO and the other shell-owned names are never resolved. Tests: new hooks/shell-variables-allowlist.test.mjs 143 passed (50 of its cases failed on HEAD 38d1311 before the fix); shell-rebinder-qualifiers 23, source-shell-gate-wrapped 238, source-shell-gate 168, -escapes 11, -delete 19, store-shell-gate 52, store-write-gate 41, node-args 76, shell-write-scan 54, shell-writes 11, shell-copy-target 77, shell-segments 44, legacy-freeze-gate 104, hand-write-restore 29, patch-apply 77, all on a git archive export with the touched files overlaid. 28 mutations (scratchpad t1082-mutate.mjs) each killed. Changed existing test: shell-rebinder-qualifiers 'an extensionless path ending in a cmdlet name' (Copy-Item x src\Set-Variable) moved from stays-blocked to passes: it blocked only because the regex read the filename as a rebinder; as an operand it is not one, and the later copy to the scratch variable now resolves and passes. Redundancy found: a funsub ${ cmd; } always splits into segments whose tail is not a safe command, so no separate funsub guard exists. Known limit: the ambient shell (aliases or functions defined before the command) is invisible, as before. Handoff kit-agent-T1082: Jobs: fix. State: done, nothing open. Next: none. Files: hooks/lib/shell-variables.mjs, hooks/shell-variables-allowlist.test.mjs, hooks/shell-rebinder-qualifiers.test.mjs.

## History
- [2026-11-11 21:05] (created) bug — shell-variables.mjs rebinder check is a regex denylist and keeps failing open (KIT-T1080, T1081 follow-up, security review of 38d1311): (1)
- [2026-11-11 21:20] (comment) criterion added: every PowerShell alias, variable: provider write, braced or scoped assignment and common-parameter binding fails closed
- [2026-11-11 21:20] (comment) criterion added: every bash quote-split or escaped builtin, nameref, arithmetic and substitution form fails closed
- [2026-11-11 21:20] (comment) criterion added: a variable resolves only when every segment is a known-safe command; SHELL_REBINDERS and its helpers are deleted
- [2026-11-11 21:20] (comment) criterion added: filename operands named source/eval/Set-Variable and the cp-into-scratch positives still resolve and pass
- [2026-11-11 21:20] (comment) criterion added: mutation controls kill every allowlist guard
- [2026-11-11 21:20] (status) todo → doing
- [2026-11-11 21:57] (landed) a4dfb6f shell-variables: a variable resolves only when every segment is a known-safe command; the regex rebinder denylist is del
- [2026-11-11 21:58] (comment) ticked: every PowerShell alias, variable: provider write, braced or scoped assignment and common-parameter binding fails closed
- [2026-11-11 21:58] (comment) ticked: every bash quote-split or escaped builtin, nameref, arithmetic and substitution form fails closed
- [2026-11-11 21:58] (comment) ticked: a variable resolves only when every segment is a known-safe command; SHELL_REBINDERS and its helpers are deleted
- [2026-11-11 21:58] (comment) ticked: filename operands named source/eval/Set-Variable and the cp-into-scratch positives still resolve and pass
- [2026-11-11 21:58] (comment) ticked: mutation controls kill every allowlist guard
- [2026-11-11 21:58] (status) doing → review
