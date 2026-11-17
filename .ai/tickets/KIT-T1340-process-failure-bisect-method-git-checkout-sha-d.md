---
id: KIT-T1340
title: Process failure: bisect method 'git checkout <sha> -- <dirs>' (prescribed in dispatch briefs) copies old files but never removes paths absen
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1338]
files: []
supersedes:
superseded_by:
created: 2026-11-17T08:30:04Z
updated: 2026-11-17T09:07:33Z
fixed_commit: 7fc1d2c4
---

## Description
Process failure: bisect method 'git checkout <sha> -- <dirs>' (prescribed in dispatch briefs) copies old files but never removes paths absent at <sha>; every old-state run leaves untracked stray files (e.g. rg-townplan/src/bands.rs) that the source-delete gate forbids a subagent to remove. Prevention: briefs and a kit bisect verb restore with 'git restore --source=<sha> --staged --worktree -- <dirs>' or a verb that also deletes paths missing at the source (confirm the delete gate allows it), and restore-to-HEAD leaves the tree clean.

kit-bug-shape: cap:bug:process-failure-bisect-method-git-checkout-sha-d:8a866639
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] restore-tree <rev> <dir>... restores the directories to the revision, removing the files it lacks that git knows from some commit; restore-tree --back <dir>... returns them to HEAD and removes the strays; a restore that would destroy bytes no commit holds refuses, changing nothing (scripts/restore-tree.test.mjs 25 passed)
- [x] the hand-write check and the delete gate pass what the verb does and still block a raw rm of a stray, a redirect, a scratch script or impostor named restore-tree, and content written beside the verb (hooks/restore-tree-gates.test.mjs 15 passed, 3 failed with the recogniser off)
- [x] q gates agent and q gates source name the verb, a dispatch brief that prescribes git checkout <rev> -- <dir> or git restore --source is refused and pointed at it, and the delete refusal names restore-tree --back (hooks/dispatch-path-restore.test.mjs 17 passed, gate-protocol 54 passed)

## Plan
1.

## Notes
Fix commits 7fc1d2c4, 286ee91c (exec bit), 69469974. Design: scripts/restore-tree.mjs + scripts/restore-tree/{plan,repo}.mjs, shim bin/restore-tree(.cmd) (on PATH beside q); the name has no git- prefix so git never reads it as an external subcommand. Invariant: a file is overwritten or removed only when HEAD or a commit reachable from HEAD, a branch, a tag or a remote holds its bytes at that path (history-blobs.mjs, the KIT-T1337 proof); otherwise the run refuses, changing nothing. Going to an older revision leaves the index alone; going to HEAD also resets the index entries of written files and drops the entries a raw checkout staged for files HEAD lacks (a worktree-only restore left CRLF files showing modified). Gates: hooks/lib/restore-tree-call.mjs makes the bare verb or node on the kit script count as git in restored-content.mjs; impostors do not. New dispatch check path-restore refuses a brief that prescribes git checkout <rev> -- <dir> or git restore --source=<non-HEAD> unless it names restore-tree (a kit brief that only discusses the raw forms must name restore-tree too). Test runs at 69469974: scripts/restore-tree.test.mjs 30 passed; hooks/restore-tree-gates.test.mjs 16 passed (3 failed with the recogniser off); hooks/dispatch-path-restore.test.mjs 18 passed; hooks/gate-protocol.test.mjs 54; hooks/source-shell-gate-delete.test.mjs 63; hooks/hand-write-restore-history.test.mjs 9; hooks/source-shell-gate-chained.test.mjs 16; source-shell-gate 168, -git-gaps 133, -copy-variable 17, dispatch-guard 46 PASS lines; scripts/contract-rules.test.mjs 48; scripts/move-lines.test.mjs 63. hooks/hand-write-restore.test.mjs fails the same 2 controls at HEAD before these edits: KIT-T1277. Handoff: hooks/hand-write-detect.test.mjs imports restored-content.mjs and did not finish inside the 170 s window; run it once in the background: node hooks/hand-write-detect.test.mjs. Known limit: a file over 256 MiB refuses the run (nothing can prove its bytes).

## History
- [2026-11-17 08:30] (created) bug — Process failure: bisect method 'git checkout <sha> -- <dirs>' (prescribed in dispatch briefs) copies old files but never removes paths absen
- [2026-11-17 08:56] (comment) criterion added: restore-tree <rev> <dir>... restores the directories to the revision, removing the files it lacks that git knows from some commit; restore-tree --back <dir>... returns them to HEAD and removes the strays; a restore that would destroy bytes no commit holds refuses, changing nothing (scripts/restore-tree.test.mjs 25 passed)
- [2026-11-17 08:57] (comment) criterion added: the hand-write check and the delete gate pass what the verb does and still block a raw rm of a stray, a redirect, a scratch script or impostor named restore-tree, and content written beside the verb (hooks/restore-tree-gates.test.mjs 15 passed, 3 failed with the recogniser off)
- [2026-11-17 08:57] (comment) criterion added: q gates agent and q gates source name the verb, a dispatch brief that prescribes git checkout <rev> -- <dir> or git restore --source is refused and pointed at it, and the delete refusal names restore-tree --back (hooks/dispatch-path-restore.test.mjs 17 passed, gate-protocol 54 passed)
- [2026-11-17 08:57] (landed) 7fc1d2c4 restore-tree: bisecting by path restore is safe end to end (implements KIT-T1340, KIT-T1338)
- [2026-11-17 08:58] (landed) 286ee91c bin/restore-tree: executable bit, as the other sh shims carry (implements KIT-T1340)
- [2026-11-17 09:06] (landed) 69469974 restore-tree: --back clears the index entries a raw checkout staged, no 1 MiB limit, narrower brief check (implements KI
- [2026-11-17 09:06] (comment) ticked: restore-tree <rev> <dir>... restores the directories to the revision, removing the files it lacks that git knows from some commit; restore-tree --back <dir>... returns them to HEAD and removes the strays; a restore that would destroy bytes no commit holds refuses, changing nothing (scripts/restore-tree.test.mjs 25 passed)
- [2026-11-17 09:07] (comment) ticked: the hand-write check and the delete gate pass what the verb does and still block a raw rm of a stray, a redirect, a scratch script or impostor named restore-tree, and content written beside the verb (hooks/restore-tree-gates.test.mjs 15 passed, 3 failed with the recogniser off)
- [2026-11-17 09:07] (comment) ticked: q gates agent and q gates source name the verb, a dispatch brief that prescribes git checkout <rev> -- <dir> or git restore --source is refused and pointed at it, and the delete refusal names restore-tree --back (hooks/dispatch-path-restore.test.mjs 17 passed, gate-protocol 54 passed)
- [2026-11-17 09:07] (status) todo → review
