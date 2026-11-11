---
id: KIT-T1068
title: source-shell-gate gap: git apply, patch -p1, git am and git checkout <rev> -- <src path> write source files from a hand-written diff and pas
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T18:15:58Z
updated: 2026-11-11T19:05:57Z
---

## Description
source-shell-gate gap: git apply, patch -p1, git am and git checkout <rev> -- <src path> write source files from a hand-written diff and pass the gate (only Edit and Write run pre-write). Seen: a groovegrid agent wrote me_a.patch with a heredoc into the scratchpad and ran git apply on src/ui/MainEditor.h in the same command, 2026-11-11 (agent-ada2dbc9). Fix: judge git apply / patch whose diff body was authored in the same command (heredoc or redirect) as a hand write of the files it names; a patch file from elsewhere stays allowed

kit-bug-shape: cap:bug:source-shell-gate-gap-git-apply-patch-p1-git-am-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed ab38144, live in runtime 01179ca. Cause: shell-write-scan returned after the redirect scan for a git-led segment and never judged patch at all. Fix: hooks/lib/patch-apply.mjs patchApplyHits(): git apply, git am and patch (leader of a segment) are judged by the files the diff headers name (diff --git, ---, +++ with -pN stripped), read from the raw command (heredoc body, printf pipe) and from a patch file under the temp dir (file operand or < redirect; both the 8.3 and the long temp spelling, readTempScript now compares real paths); patch operand or -o is judged as a write; git -C dir prefixes the path. The caller hit() decides, so source-shell-gate and store-shell-gate both inherit it. Passes: --check --stat --numstat --summary --cached, patch --dry-run, git am --abort, a patch file the gate cannot read (not a temp file), a diff naming no source file, diffs piped from git. NOT blocked on purpose: git checkout <rev> -- <path> and git restore: they put back content a commit or stash already holds (gated when written), branch-guard (KIT-T082) and hand-write-restore (KIT-T977, KIT-T933) allow it explicitly and worktree-guard recommends it. Tests: patch-apply 42, source-shell-gate 168, store-shell-gate 52, shell-write-scan 54, node-args 76, legacy-freeze-gate 104, shell-segments 44, hand-write-detect 69, hand-write-restore 29, tree-delete-gate 27, shell-writes 11.
Handoff kit-agent-2026-11-11 (fix batch KIT-T1068/T1069/T1071/T1012): Jobs: all four fixed, committed, pushed (9c9a60a, ab38144, 01179ca) and published as runtime 01179ca. State: tickets in review awaiting maintainer. KIT-T944 files (commit-gate, dispatch-holder, holder-beat, checkout-holder, tool-writes, claim-release.test) untouched and uncommitted; another writer began editing hooks/lib/shell-write-scan.mjs (deletes: true) and hooks/lib/owns-untracked-file.mjs after my commit, not mine. Next: none required; open question for the maintainer is whether git checkout <rev> -- <src path> should also be judged (left allowed, see notes above). Files: hooks/lib/patch-apply.mjs, hooks/lib/shell-write-scan.mjs, hooks/lib/git-subcommand.mjs, hooks/lib/search-targets.mjs, scripts/plugin-drift.mjs, scripts/runtime-publish.mjs.
RESIDUAL (live in runtime 01179ca, NOT fixed): patchApplyHits in hooks/lib/patch-apply.mjs reads only the segment leader, so a wrapper steers around it and still passes: sudo patch -p1 heredoc, env A=1 git apply heredoc, command git apply <temp patch>; and a patch fed on stdin by a pipe from a temp file (cat <temp patch> | git apply) passes because only an operand or a < redirect is read. Also by design a patch saved by Write OUTSIDE the temp dir and then applied passes (the patch from elsewhere rule). Fix in patch-apply.mjs only: scan every word of the segment for git/patch (as shell-write-scan promises for write tools) and read temp paths the raw command names when the applier reads stdin.

## History
- [2026-11-11 18:15] (created) bug — source-shell-gate gap: git apply, patch -p1, git am and git checkout <rev> -- <src path> write source files from a hand-written diff and pas
- [2026-11-11 18:23] (comment) @claude: Evidence for the fix agent: groovegrid agent-ada2dbc9 wrote me_a.patch (heredoc into the scratchpad) and ran git apply o (full comment #1 in ## Notes)
### comment #1 [2026-11-11 18:23] @claude
Evidence for the fix agent: groovegrid agent-ada2dbc9 wrote me_a.patch (heredoc into the scratchpad) and ran git apply on src/ui/MainEditor.h in one command; source-shell-gate passed it. Probed shapes that pass: git apply, patch -p1 < file, git am < mbox, git checkout stash@{0} -- src/file. A python heredoc write to src/state/Roles.h was blocked, so the gate works for that route.
- [2026-11-11 18:59] (status) todo → review
- [2026-11-11 19:00] (landed) 31b568a tickets: KIT-T1068, T1069, T1071 fixed and in review with notes and Handoff, KIT-T1012 confirmed fixed (implements KIT-T
- [2026-11-11 19:05] (status) review → todo
- [2026-11-11 19:05] (comment) remaining after 1 landed commit(s): wrapper-led git apply/patch (sudo, env, command) and stdin-from-pipe temp patch pass the gate; fix in hooks/lib/patch-apply.mjs
