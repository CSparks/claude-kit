---
id: KIT-T882
title: checkout-holder / foreign-tree-edits guards claim a live writer (session 7b9309f1, last write 0 min ago) in D:/dev/claude-kit and flag scrip
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T17:31:32Z
updated: 2026-11-07T18:15:48Z
---

## Description
checkout-holder / foreign-tree-edits guards claim a live writer (session 7b9309f1, last write 0 min ago) in D:/dev/claude-kit and flag scripts/broker/jobs.mjs, but Chris states there is no writer in that repo. The kit tree has only .ai/ ticket/decision modifications, which this groovegrid session's own cap/t decide calls wrote (KIT-T880, KIT-T881, KIT-D136), so the guard likely counts a project session's kit-store writes as a live implementer writer. jobs.mjs mtime 2026-11-07 11:28 is unexplained. Blocked the KIT-T881 fix dispatch 2026-11-07.

kit-bug-shape: cap:bug:checkout-holder-foreign-tree-edits-guards-claim-
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A store (.ai/) write by another repo's session never registers a checkout hold; a same-session source write still does (hooks/dispatch-holder.test.mjs)
- [x] The block names the holder's origin project, agent, entry file to delete and the 15 min lapse rule

## Plan
1.

## Notes
Root cause, from disk (2026-11-07): the block was CORRECT, not a scoping bug. Holder entry 7b649f6296068a9d/7b9309f1-....json: tree D:/dev/claude-kit, label claude-kit:implementer, agent ade671d69b4f50396. Session 7b9309f1 is a stiletto-2349 session: its roster (D:/dev/stiletto-2349/.ai/agents.jsonl) holds that agent in-flight at 17:22:56Z, task "Machine-wide Rust build controller", ticket KIT-T879, targetRoot D:/dev/claude-kit. Its transcript was still being written at 11:36 CST, and the dirty scripts/broker/{build-slot,cargo-subs,jobs}.mjs plus the new build-*.mjs files were its work (committed since as 051a7c7). No cap/t call from groovegrid can produce an entry: cap/t run through Bash, and holder-beat fires only on Write|Edit. foreign-tree-edits flagged jobs.mjs for the same reason (another session's agent edited it; .ai/ paths were already excluded).
Related: KIT-T811 / KIT-D123 (checkout-holder), KIT-T407 (foreign-tree-edits), KIT-T177 (targetRoot on roster rows), KIT-T417.
Fixed (latent, not the cause): a Write/Edit of .ai/ store files by a session in another repo beat a hold on that checkout. holder-beat now skips store paths with the predicate foreign-tree-edits already used (extracted to isStorePath in hooks/lib/paths.mjs). The registry also never said where a session came from; entries now carry origin (the session's own repo) and the block prints it with the agent, the entry file, the 15 min lapse rule, `rm "<entry file>"` to clear a stale hold, and the origin roster path. The foreign-tree block says how it attributes edits.
Where the guards get a writer's tree (Chris asked whether the kit tracks which workspace a writer is tasked with): at dispatch, dispatchTargetRoot (the [tree:] token, else a repo root named in the brief) is stamped as targetRoot on the roster row (agent-roster.mjs, KIT-T177) and is the registry key. A heartbeat's tree is the git root of the edited file. shared-tree-dispatch and foreign-tree-edits filter roster rows by targetRoot (rowSharesTree), never by session; checkout-holder is keyed by tree and excludes only the dispatching session's own entry. Roster rows merge by agent id, so a SubagentStop row inherits targetRoot from its dispatch row; a stop-only row (no dispatch row) is terminal and never counts as live.
State: committed on main (470b6b8, 8a794b6), not pushed. NOT published: publish:runtime exported HEAD and the suite was red on scripts/broker/build-contention-run.test.mjs (KIT-T879/T874 area, not touched here); current stays 32d78e3. An earlier run exported 470b6b8 and failed 6 files that are absent from that sha (build-*.test.mjs, no-api-calls), so the suite's file list is not only the export's.
Tests run: dispatch-holder 20 PASS, dispatch-foreign-tree 9, dispatch-guard 46, agent-roster 47, lib 9, all green.
Handoff ab91838d09515cc0f:
- Jobs: KIT-T882 code done and committed; KIT-T881 code done and committed.
- State: see above; publish blocked on the red broker test, which belongs to the KIT-T879 writer.
- Next: when scripts/broker/build-contention-run.test.mjs is green on HEAD, run npm run publish:runtime. The stiletto KIT-T879 implementer ran in this checkout; its hold has since lapsed.
- Files: hooks/lib/paths.mjs, hooks/lib.mjs, hooks/holder-beat.mjs, hooks/lib/checkout-holder.mjs, hooks/dispatch-holder.mjs, hooks/dispatch-foreign.mjs, hooks/dispatch-guard.mjs, hooks/dispatch-holder.test.mjs.

## History
- [2026-11-07 17:31] (created) bug — checkout-holder / foreign-tree-edits guards claim a live writer (session 7b9309f1, last write 0 min ago) in D:/dev/claude-kit and flag scrip
- [2026-11-07 17:31] (comment) @claude: Chris 2026-11-07: "Writers are supposed to be SCOPED TO THE REPO THEY ARE WRITING ON, NOT GLOBALLY." and "So it sounds l (full comment #1 in ## Notes)
### comment #1 [2026-11-07 17:31] @claude
Chris 2026-11-07: "Writers are supposed to be SCOPED TO THE REPO THEY ARE WRITING ON, NOT GLOBALLY." and "So it sounds like THAT bug was never fixed." The writer/checkout-holder guard must count only writers whose cwd/tree is the dispatch tree; a session in another repo (groovegrid) writing the kit store via cap/t decide is not a writer in the kit checkout. Likely a regression or an unfixed earlier bug: the fix agent must search q fts for prior tickets (KIT-T811, KIT-D123, KIT-T407) and link them.
- [2026-11-07 17:57] (landed) 470b6b8 checkout-holder: store (.ai/) writes never register a hold, entries record the session's origin repo and the block names
- [2026-11-07 18:07] (comment) criterion added: A store (.ai/) write by another repo's session never registers a checkout hold; a same-session source write still does (hooks/dispatch-holder.test.mjs)
- [2026-11-07 18:07] (comment) ticked: A store (.ai/) write by another repo's session never registers a checkout hold; a same-session source write still does (hooks/dispatch-holder.test.mjs)
- [2026-11-07 18:07] (comment) criterion added: The block names the holder's origin project, agent, entry file to delete and the 15 min lapse rule
- [2026-11-07 18:07] (comment) ticked: The block names the holder's origin project, agent, entry file to delete and the 15 min lapse rule
- [2026-11-07 18:14] (landed) 8a794b6 question-brief: a lettered option is picked only by its key after a picking verb; foreign-tree and holder messages name
- [2026-11-07 18:15] (edit) Notes replaced
- [2026-11-07 18:15] (status) todo → review
