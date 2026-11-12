---
id: KIT-T1091
title: touch-target.mjs (KIT-T1088, 8ba4e22) fails open via cd-prelude mismatch (security review): the existence check resolves against commandCwd
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T01:58:26Z
updated: 2026-11-12T02:34:27Z
---

## Description
touch-target.mjs (KIT-T1088, 8ba4e22) fails open via cd-prelude mismatch (security review): the existence check resolves against commandCwd but the prelude accepts cd with no argument, ~, -, dash-led arguments, set-location, and assignments to CDPATH/HOME/OLDPWD/PWD, so the shell's real cwd can differ from the checked one and touch can CREATE a source file the check believed existed. Fix: accept a cd prelude only when its argument is one plain token that commandCwd followed to an existing directory using the same parser; reject cd without argument, ~, -, option-led args, set-location unless commandCwd follows them; drop assignments to CDPATH/HOME/OLDPWD/PWD from the prelude; fail closed whenever commandCwd did not follow every cd-like segment

kit-bug-shape: cap:bug:touch-target-mjs-kit-t1088-8ba4e22-fails-open-vi
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-12 01:58] (created) bug — touch-target.mjs (KIT-T1088, 8ba4e22) fails open via cd-prelude mismatch (security review): the existence check resolves against commandCwd
- [2026-11-12 02:33] (landed) 9bbee2f source-shell-gate: a touch lifts only when commandCwd demonstrably followed every cd of the command (touch-place.mjs): c
- [2026-11-12 02:34] (comment) @claude: Fix 9bbee2f (pushed), runtime 9bbee2f published. New hooks/lib/touch-place.mjs owns touchPlaceKnown(parts, at, raw): eve (full comment #1 in ## Notes)
### comment #1 [2026-11-12 02:34] @claude
Fix 9bbee2f (pushed), runtime 9bbee2f published. New hooks/lib/touch-place.mjs owns touchPlaceKnown(parts, at, raw): every segment up to the touch has operator start/;/&& (no pipe, background, ||); prelude is cd, assignment (not CDPATH/HOME/OLDPWD/PWD), echo, ls, pwd, true, touch (set-location dropped); every cd is 'cd <one plain literal>' (no option, ~, -, /d, .., redirect, glob, variable, drive-relative, empty; with CDPATH in the environment only ./ / or drive paths) naming an existing directory under the walked cwd; the walk must equal commandCwd(raw) (same parser cross-check, catches splitter disagreement such as echo \; cd src); a later cd of any form blocks. shell-cwd.mjs commandCwd now follows only directories (isDirectory exported, shared): separate fail-open fixed, cd <file> used to point every hook cwd at a file so the root lookup failed and the gate no-opped. Files beyond brief paths: hooks/lib/touch-place.mjs (new), hooks/lib/shell-write-scan.mjs (import + call passes segments and raw), hooks/lib/shell-cwd.mjs. touch-target.mjs lost its prelude code. Tests (working tree = commit): source-shell-gate-touch 113 (73 old + 40 new), source-shell-gate 168, source-shell-gate-wrapped 238, shell-copy-target 76, shell-copy-target-dir 44, shell-variables-allowlist 192, all pass. Control: new test file on the HEAD(8ba4e22) libs fails 26 of 113, every cd case rewritten so the touched path exists under commandCwd but not the shell's real cwd. Mutations on a git archive copy (scratchpad mutate.mjs, 12): killed no-operator-check, no-assignment-ban, no-cross-check, parent-segment, cd-leader-unchecked, inherited-CDPATH, commandCwd-follows-files; survivors are redundant layers (existence check, option check, one-token check, later-cd check, set-location leader are each also covered by the commandCwd cross-check / cdTarget equality). Not run: importers of shell-cwd (stdin.mjs setShellCwd, inert-command.mjs) have no test touching a cd to a file; source-shell-gate.test.mjs (the KIT-T700 cd tests) passes. Probing the real runtime from the groovegrid checkout was blocked by the gate on my own probe line (process failure, KIT-T1092 filed). Handoff kit-agent-T1091: Jobs: fix. State: done, nothing open. Next: none. Files: hooks/lib/touch-place.mjs, hooks/lib/touch-target.mjs, hooks/lib/shell-write-scan.mjs, hooks/lib/shell-cwd.mjs, hooks/source-shell-gate-touch.test.mjs.
- [2026-11-12 02:34] (status) todo → review
