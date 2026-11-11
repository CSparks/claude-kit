---
id: KIT-T1075
title: source-shell-gate residuals after KIT-T1068/T984: (1) shell-write-scan PATCH_TOKEN sees only a leading git/patch so a wrapper in an ambiguou
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T19:19:58Z
updated: 2026-11-11T19:55:46Z
---

## Description
source-shell-gate residuals after KIT-T1068/T984: (1) shell-write-scan PATCH_TOKEN sees only a leading git/patch so a wrapper in an ambiguously quoted command escapes; (2) applier inside bash -c / sh -c strings not judged; (3) cp of a source file into a $VAR scratchpad path blocks as a hand write because the gate cannot resolve variables (T984 family)

kit-bug-shape: cap:bug:source-shell-gate-residuals-after-kit-t1068-t984
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] An applier behind a wrapper (sudo, env, command, timeout) or grouping word in an ambiguously quoted command blocks through the patch-apply lead scan, not a second wrapper list
- [x] An applier inside bash -c, sh -lc, pwsh -Command or eval is judged by the same rules; read-only forms still pass
- [x] A cp into a variable the command assigns once literally before use is judged by the value; any other variable stays fail-closed

## Plan
1.

## Notes
Fixed 314d3f0 and 355b305, pushed, published as runtime 355b305. (1) shell-write-scan ambiguousWrite now calls appliesPatch from patch-apply.mjs (the PATCH_TOKEN regex is gone): any piece cut on every operator that runs git apply or git am anywhere, or is led by patch past wrappers and grouping words, or by a shell whose command string is; one wrapper list, in patch-apply.mjs. (2) patchApplyHits(text, ctx) takes the segment text, finds the applier past wrappers, then and do and bang, and a bash, sh, zsh, dash, ksh, ash -c or -lc string, pwsh or powershell -Command, or eval is split into segments and judged by the same rules to 4 levels. (3) Root cause of the cp block: the gate could not resolve a variable, so the destination was impure, the shape unproven and every operand a write. New hooks/lib/shell-variables.mjs resolves NAME only from one literal assignment (bash NAME=value or export, PowerShell dollar-name = quoted literal) in an earlier unconditional segment, the only write to that name in the command, no eval or source, value free of dollar and backtick, unquoted only when the value is plain, never in single quotes or behind an escape; copyTargets then runs on the expanded text so the proven shape, landsOutsideRepo and the existing-directory check decide. A copy whose destination stays unresolved remains fail-closed on purpose: KIT-T984 kept the destination may be a directory case blocked, so a non-source tail is no proof. shellArgs moved to shell-segments.mjs (with shellTokens, dequoted); inert-command.mjs and node-args.test.mjs import it from there. Tests: hooks/source-shell-gate-wrapped.test.mjs 97; run on a git archive export of 355b305: patch-apply 77, source-shell-gate 168, store-shell-gate 52, shell-write-scan 54, shell-copy-target 77, legacy-freeze-gate 104, node-args 76, hand-write-detect 69, hand-write-restore 29, shell-segments 44, tree-delete-gate 27, shell-writes 11, source-shell-gate-delete 19, source-shell-gate-escapes 11. Probe of 87 real hook payloads: 26 diffs at f987a22, 0 at 355b305. Mutation controls on an export: 15 of 15 killed. Not fixed, filed KIT-T1076: an applier run from another command in an unambiguous line (find -exec git apply, ssh host git apply, a trap string, an echo of a command substitution) passes before and after.
Handoff kit-agent-2026-11-11c (KIT-T1075): Jobs: all three residuals fixed, committed, pushed (314d3f0, 355b305), runtime 355b305. State: ticket in review. Next: KIT-T1076 (non-leading applier in an unambiguous line); the process-failure note is KIT-T1077. Files: hooks/lib/patch-apply.mjs, hooks/lib/shell-write-scan.mjs, hooks/lib/shell-variables.mjs (new), hooks/lib/shell-segments.mjs, hooks/lib/inert-command.mjs, hooks/node-args.test.mjs, hooks/source-shell-gate-wrapped.test.mjs (new).

## History
- [2026-11-11 19:19] (created) bug — source-shell-gate residuals after KIT-T1068/T984: (1) shell-write-scan PATCH_TOKEN sees only a leading git/patch so a wrapper in an ambiguou
- [2026-11-11 19:41] (landed) 314d3f0 shell write gates: an applier behind a wrapper or grouping word in an ambiguous line, inside bash -c / sh -lc / pwsh -Co
- [2026-11-11 19:46] (landed) 355b305 patch-apply: an ambiguous line names git apply or git am anywhere again (parity with the old scan); tests for grouping w
- [2026-11-11 19:54] (comment) criterion added: An applier behind a wrapper (sudo, env, command, timeout) or grouping word in an ambiguously quoted command blocks through the patch-apply lead scan, not a second wrapper list
- [2026-11-11 19:55] (comment) criterion added: An applier inside bash -c, sh -lc, pwsh -Command or eval is judged by the same rules; read-only forms still pass
- [2026-11-11 19:55] (comment) criterion added: A cp into a variable the command assigns once literally before use is judged by the value; any other variable stays fail-closed
- [2026-11-11 19:55] (comment) ticked: An applier behind a wrapper (sudo, env, command, timeout) or grouping word in an ambiguously quoted command blocks through the patch-apply lead scan, not a second wrapper list
- [2026-11-11 19:55] (comment) ticked: An applier inside bash -c, sh -lc, pwsh -Command or eval is judged by the same rules; read-only forms still pass
- [2026-11-11 19:55] (comment) ticked: A cp into a variable the command assigns once literally before use is judged by the value; any other variable stays fail-closed
- [2026-11-11 19:55] (status) todo → review
