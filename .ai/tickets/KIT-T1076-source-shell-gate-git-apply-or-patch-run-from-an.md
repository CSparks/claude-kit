---
id: KIT-T1076
title: source-shell-gate: git apply or patch run from another command passes in an unambiguous line (find -exec git apply, ssh host git apply, trap
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T19:44:29Z
updated: 2026-11-11T20:25:11Z
---

## Description
source-shell-gate: git apply or patch run from another command passes in an unambiguous line (find -exec git apply, ssh host git apply, trap string, echo of a command substitution holding git apply with a heredoc diff); only a segment-leading applier is judged, ambiguous lines block them. Found KIT-T1075, pass before and after.

kit-bug-shape: cap:bug:source-shell-gate-git-apply-or-patch-run-from-an
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] An applier another command runs (find -exec/-execdir/-ok/-okdir, ssh remote command, su -c, trap string, $(...), backtick and <(...) substitution) is judged by the patch-apply scan in an unambiguous and an ambiguous line
- [x] echo patch, grep -n patch f, command -v git and read-only forms (--check, --stat, --numstat, --summary, --cached, patch --dry-run, git am --abort) stay allowed through every runner

## Plan
1.

## Notes
Fixed ac62f3d, pushed, published as runtime ac62f3d. Root cause: patchApplyHits judged only an applier that LEADS its segment (past wrappers) or sits in a shell -c string; any other command whose operands are a command (find -exec, ssh, trap, su -c, a substitution) was never read, and the ambiguous fallback appliesPatch counted git apply anywhere but patch only at a lead. Fix, one home in hooks/lib/patch-apply.mjs: runnerTexts(name, rest, {shell, blind}) is the one table of commands that run a string (sh/bash -c, eval, pwsh -Command, su/runuser -c, every clause of find -exec|-execdir|-ok|-okdir, the remote command of ssh past its value flags and host, the first operand of trap); runnerCommands finds the lead runner past the existing wrapper list (sudo find, timeout 5 ssh, env A=1 trap); substitutions() reads every $(...), <(...), >(...) and backtick pair outside single quotes and escapes (bash; PowerShell only $(...)), including inside double quotes; patchApplyHits judges lead hits plus every runner string and substitution as segments, to 4 levels; appliesPatch (ambiguous lines) takes the same runner table, so ambiguous find/ssh/trap/su/substitution of patch now block too. Allowed still: echo patch, grep -n patch, command -v git, find -name patch, ssh host ls, trap with no applier, trap - SIG, single-quoted or escaped substitutions, --check --stat --numstat --summary --cached, patch --dry-run, git am --abort, a diff that names no source. Deliberately conservative: ssh and su targets resolve on another host or user, the gate still judges the diff paths as local. Not provable, left alone: docker/kubectl exec, parallel, watch, flock, nsenter, chroot, script -c, at/batch, cron lines, xargs -I with a sh -c string built at run time (xargs is already a wrapper), a command string held in a variable or a function body, source of a script file. Tests: hooks/source-shell-gate-wrapped.test.mjs 204 (97 + 107 new: 29 runner blocks each in plain and ambiguous lines, store gate x4, 29 read-only or data passes, 5 ambiguous passes, 7 appliesPatch patch runners, nesting bound); on a git archive export of 6b6d75c plus the three files: patch-apply 77, source-shell-gate 168, store-shell-gate 52, shell-write-scan 54, shell-copy-target 77, legacy-freeze-gate 104, node-args 76, hand-write-detect 69, hand-write-restore 29, shell-segments 44, tree-delete-gate 27, shell-writes 11, source-shell-gate-delete 19, source-shell-gate-escapes 11. Real hook payload probes: 111 cases, 33 expected misses at 6b6d75c, 0 at ac62f3d; 44 ambiguous and heredoc-in-substitution cases, 19 misses before, 0 after. Mutation controls on 14 exports (drop find, ssh, trap, su, $(, backtick, <(, the ambiguous runner lookup, single-quote skip, escape skip, ssh value flags, second find clause, redirect-token strip, single-operand dequote): 14 of 14 killed. File length: hooks/lib/patch-apply.mjs is 336 lines (warn 300): a split of the generic lead scan (leadIndex, WRAPPER, commandName) plus runnerTexts into its own lib file is the follow-up, not done here (outside the paths of this ticket). Found on the way: KIT-T1080 (shell-variables SHELL_REBINDERS matches the word source inside a filename). Process failures this run: a probe script holding writeFileSync, and a cp into a directory, both blocked and fixed by Write-only fixtures and a literal destination; the same family as KIT-T1077.
Handoff kit-agent-2026-11-11d (KIT-T1076): Jobs: fixed, tested, committed, pushed (ac62f3d), runtime ac62f3d. State: ticket in review. Next: optional split of patch-apply.mjs (336 lines) and KIT-T1080 (one-line regex in hooks/lib/shell-variables.mjs). Files: hooks/lib/patch-apply.mjs, hooks/lib/shell-write-scan.mjs, hooks/source-shell-gate-wrapped.test.mjs.
Correction to the probe counts above: 80 payloads in the first probe (33 misses at 6b6d75c, 0 at ac62f3d) and 41 in the second (19 misses before, 0 after); 121 real hook payloads in all.

## History
- [2026-11-11 19:44] (created) bug — source-shell-gate: git apply or patch run from another command passes in an unambiguous line (find -exec git apply, ssh host git apply, trap
- [2026-11-11 20:23] (landed) ac62f3d patch-apply: an applier another command runs is judged (find -exec/-execdir/-ok, ssh remote command, su -c, trap string,
- [2026-11-11 20:24] (comment) criterion added: An applier another command runs (find -exec/-execdir/-ok/-okdir, ssh remote command, su -c, trap string, $(...), backtick and <(...) substitution) is judged by the patch-apply scan in an unambiguous and an ambiguous line
- [2026-11-11 20:24] (comment) criterion added: echo patch, grep -n patch f, command -v git and read-only forms (--check, --stat, --numstat, --summary, --cached, patch --dry-run, git am --abort) stay allowed through every runner
- [2026-11-11 20:24] (comment) ticked: An applier another command runs (find -exec/-execdir/-ok/-okdir, ssh remote command, su -c, trap string, $(...), backtick and <(...) substitution) is judged by the patch-apply scan in an unambiguous and an ambiguous line
- [2026-11-11 20:25] (comment) ticked: echo patch, grep -n patch f, command -v git and read-only forms (--check, --stat, --numstat, --summary, --cached, patch --dry-run, git am --abort) stay allowed through every runner
- [2026-11-11 20:25] (status) todo → review
