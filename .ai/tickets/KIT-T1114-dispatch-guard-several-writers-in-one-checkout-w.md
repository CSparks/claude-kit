---
id: KIT-T1114
title: dispatch guard: several writers in one checkout when their declared paths do not overlap (the maintainer's rule 2026-11-13: 'WHY THE FUCK IS
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T05:00:46Z
updated: 2026-11-13T05:47:11Z
---

## Description
dispatch guard: several writers in one checkout when their declared paths do not overlap (the maintainer's rule 2026-11-13: 'WHY THE FUCK IS THE NUMBER OF WRITING AGENTS EVEN FUCKING LIMITED. THE ONLY FUCKING FACTOR IS IF A FUCKING WRITE FUCKS WITH A BUILD.'). Today shared-tree-dispatch refuses a second writer in any checkout but claude-kit's (KIT-D077); the claude-kit checkout already allows writers whose declared [paths:] do not overlap (KIT-D155). Wanted: that path rule for EVERY checkout: a writer declares [paths: ...] (crates, folders, files); a second writer is refused only when its paths overlap an in-flight writer's, or (for Rust workspaces, where it can be read from Cargo metadata) when it edits a crate an in-flight writer's crate depends on or the reverse; a writer with no [paths:] still counts as owning the whole tree. Also: refuse [tree: X] when the brief's ticket belongs to a different project than X unless the maintainer's quoted words are present (borrowing another game's checkout as a scratch copy of the framework was the failure that prompted this). Update the composed CLAUDE.md source text of KIT-D077 to match and record the superseding kit decision with his words. Road-generator decision recording it: the newest RDG decision 2026-11-13.

kit-bug-shape: cap:feature:dispatch-guard-several-writers-in-one-checkout-w
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 36e5bcb + f1f968f, runtime f1f968f published, decision KIT-D167 (supersedes KIT-D077, KIT-D144's one-writer limit). Items: (1) hooks/dispatch-shared-tree.mjs: any number of writers; [paths:] required beside an in-flight writer, refused only on overlap; the ticket line 'a writer with no [paths:] owns the whole tree' is overridden by the maintainer's words. (2) hooks/holder-beat.mjs + lib/agent-claims.mjs: per-writer file claims refuse another agent or session's write, naming the agent; lib/checkout-holder.mjs claimFile/liveClaimants; checkout-holder judges every checkout per file. (3) built: lib/build-write-hold.mjs + scripts/broker/cargo-scope-dirs.mjs: the build hold records scope + writer (CLAUDE_KIT_BUILD_WRITER from build-wrap/row-tag), another writer's write to a build input in scope while it compiles is refused. Residuals: a workspace whose root is itself a package scopes the whole root; a build started outside a Claude shell call has no writer id and holds back every agent; the ticket's cargo-dependency rule for item 1 is not built (the build guard covers it at write time). (4) hooks/dispatch-tree-project.mjs, tag [maintainer-asked-tree: <his words>]. (5) CLAUDE.global.md source, commands/drain.md, hooks/README.md, q gates agent. Follow-up: landgate narrowed() duplicates precheck-scope checkOf. Tests (node, run by me): dispatch-shared-tree 71 checks, dispatch-holder, dispatch-foreign-tree, session-overlap, agent-claims 16, build-write-hold 11, dispatch-tree-project 11, gate-protocol 49, dispatch-guard, claim-release, claim-release-controls, build-wrap 6, cargo-scope-dirs 5, all exit 0.

## History
- [2026-11-13 05:00] (created) feature — dispatch guard: several writers in one checkout when their declared paths do not overlap (the maintainer's rule 2026-11-13: 'WHY THE FUCK IS
- [2026-11-13 05:01] (comment) @claude: Chris 2026-11-13, the intent of the writer limit in his words: 'SOmething is SERIOUSLY fucked in the execution of that c (full comment #1 in ## Notes)
### comment #1 [2026-11-13 05:01] @claude
Chris 2026-11-13, the intent of the writer limit in his words: 'SOmething is SERIOUSLY fucked in the execution of that concept.' 'The aim was NEVER to stop multiple fucking writers.' 'The aim was to stop MULTIPLE WRITERS ON THE SAME FUCKING FILE OR WHILE A BUILD WAS RUNNING. HOLY FUCKING SHIT.' So the guard's job is exactly two things: (1) no two writers on the same file at once; (2) no write landing in files a running build is compiling. Everything else about writer COUNT per checkout is wrong and goes: shared-tree-dispatch must not refuse a second writer because one is in flight.
- [2026-11-13 05:25] (landed) 3dda8b0 dispatch guard: any number of writers share a checkout; refuse only overlapping [paths:], a same-file write, a write int
- [2026-11-13 05:25] (landed) 36e5bcb dispatch guard: any number of writers share a checkout; refuse only overlapping [paths:], a same-file write, a write int
- [2026-11-13 05:45] (landed) f1f968f write guard: a per-agent file claim refuses another session's write too, naming the agent, so a live agent that builds o
- [2026-11-13 05:47] (status) todo → review
