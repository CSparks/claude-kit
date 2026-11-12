---
id: KIT-T1088
title: source-shell-gate misfire: 'touch src/state/AppState.h' (mtime-only, no content write, needed to time a header-change rebuild for GG-T222) i
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T01:22:01Z
updated: 2026-11-12T01:56:42Z
---

## Description
source-shell-gate misfire: 'touch src/state/AppState.h' (mtime-only, no content write, needed to time a header-change rebuild for GG-T222) is blocked as 'a shell command writes a source file by hand'. touch changes no content; the gate's purpose (pre-write gate on authored content) does not apply. Fix: touch of an EXISTING file is not a hand write (allow when the file exists and the command only touches); touch creating a new source file stays blocked; keep allowlist fail-closed design (KIT-T1082)

kit-bug-shape: cap:bug:source-shell-gate-misfire-touch-src-state-appsta
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a touch with only mtime options of an existing source file passes; a touch that would create a source file, a glob, an unresolved variable, any other option, or one after a segment that is not a cd, assignment, echo, ls, pwd, true or touch stays blocked
- [x] touch -c of a missing file passes; touch a.cpp && echo x > a.cpp still blocks on the second segment

## Plan
1.

## Notes
Fix 8ba4e22 (pushed), runtime 8ba4e22 published and probed with 6 real payloads from the groovegrid checkout (ticket command passes, missing file, glob, unresolved variable and touch-then-redirect block, touch -c of a missing file passes). Design: the scan tags every file operand of a segment led by touch whose tokens are proven mtime-only (shell-copy-target tokenizer; options -a -m -c clustered, -d DATE, -t STAMP, -r REF, --date, --reference, --no-create; no glob, variable, substitution, quoted or glued option) with mtimeOnly { noCreate }, and the gate (touch-target.mjs touchLifted) lifts it when the file exists relative to the command cwd or -c/--no-create creates nothing. Fail-closed guard (advisor finding): the lift applies only when every earlier segment is a cd, bare assignment, echo, ls, pwd, true or touch with no evaluated text, and no later segment is a cd, so a delete, mv, git rm, rm -rf plus mkdir or find -delete before the touch cannot make an existing-file check lie. PowerShell (Get-Item f).LastWriteTime = ... stays out of scope: the gate never blocked it (probe exits 0 and touches no word the scan matches), so nothing was added or removed. Files beyond the brief paths: hooks/lib/shell-variables.mjs (touch added to SAFE_COMMANDS, since touch binds no variable; a cp destination in the same line now resolves where the old allowlist refused), hooks/lib/shell-source-write.mjs (doc comment). Tests on a git archive export of HEAD with the touched files overlaid: source-shell-gate-touch 73 (new), source-shell-gate 168, source-shell-gate-wrapped 238, source-shell-gate-escapes 11, source-shell-gate-delete 19, store-shell-gate 52, shell-write-scan 54, shell-copy-target 76, shell-copy-target-dir 44, shell-variables-allowlist 192, shell-rebinder-qualifiers 23, node-args 76, patch-apply 77, all exit 0. Mutation controls (scratchpad t1088-mutate.mjs, 19 mutations incl. existence check, noCreate, prelude, later-cd, evaluating text, option allowlist, gate lift, leader, variable expansion, SAFE_COMMANDS): all 19 killed after one survivor (evaluating-text guard) got a find -delete substitution case. Process notes: two gate blocks hit me from my own commands (a node -e source edit, then a for-loop cp with an unresolved variable and a probe line holding a redirect into a source path): process failures, the gate behaved as designed; the first 13-suite run passed 180 s and was moved to the background by the harness (the suites need ~4 min as one call). Handoff kit-agent-T1088: Jobs: fix. State: done, nothing open. Next: none. Files: hooks/lib/touch-target.mjs, hooks/lib/shell-write-scan.mjs, hooks/lib/shell-copy-target.mjs, hooks/lib/shell-variables.mjs, hooks/lib/shell-source-write.mjs, hooks/source-shell-gate.mjs, hooks/source-shell-gate-touch.test.mjs.

## History
- [2026-11-12 01:22] (created) bug — source-shell-gate misfire: 'touch src/state/AppState.h' (mtime-only, no content write, needed to time a header-change rebuild for GG-T222) i
- [2026-11-12 01:55] (landed) 8ba4e22 source-shell-gate: a touch with only mtime options (-a -m -c -d -t -r, --date --reference --no-create) of an existing fi
- [2026-11-12 01:56] (comment) criterion added: a touch with only mtime options of an existing source file passes; a touch that would create a source file, a glob, an unresolved variable, any other option, or one after a segment that is not a cd, assignment, echo, ls, pwd, true or touch stays blocked
- [2026-11-12 01:56] (comment) criterion added: touch -c of a missing file passes; touch a.cpp && echo x > a.cpp still blocks on the second segment
- [2026-11-12 01:56] (comment) ticked: a touch with only mtime options of an existing source file passes; a touch that would create a source file, a glob, an unresolved variable, any other option, or one after a segment that is not a cd, assignment, echo, ls, pwd, true or touch stays blocked
- [2026-11-12 01:56] (comment) ticked: touch -c of a missing file passes; touch a.cpp && echo x > a.cpp still blocks on the second segment
- [2026-11-12 01:56] (status) todo → review
