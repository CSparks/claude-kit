---
id: KIT-T953
title: checkout-holder and commit-gate (KIT-D155) attribute a dispatched subagent's own writes to its parent session: a kit fix agent editing hooks
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:04:13Z
updated: 2026-11-10T19:18:33Z
---

## Description
checkout-holder and commit-gate (KIT-D155) attribute a dispatched subagent's own writes to its parent session: a kit fix agent editing hooks/lib/node-args.mjs is blocked from its own second edit and its own commit as 'another live session 5b63523a from D:/dev/stiletto-2349' (the dispatcher); diff shows only the agent's lines. Repro 2026-11-10 KIT-T951 agent. Related KIT-T944, KIT-T948

kit-bug-shape: cap:bug:checkout-holder-and-commit-gate-kit-d155-attribu
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:04] (created) bug — checkout-holder and commit-gate (KIT-D155) attribute a dispatched subagent's own writes to its parent session: a kit fix agent editing hooks
- [2026-11-10 18:42] (landed) 371c2f1 shell attribution: a file an Edit or Write of another session left during a shell call is never credited to or blamed on
- [2026-11-10 18:57] (landed) 3018084 tool-writes: a prediction is unconfirmed (no timing slack, only PostToolUse-confirmed entries get it) and names its writ
- [2026-11-10 18:58] (comment) @claude: Root cause (not the ticket's premise): subagents share the parent session_id by design (holder entry 5b63523a carries ag (full comment #1 in ## Notes)
### comment #1 [2026-11-10 18:58] @claude
Root cause (not the ticket's premise): subagents share the parent session_id by design (holder entry 5b63523a carries agent adcd..., origin stiletto). The misattribution was hooks/shell-writes.mjs crediting every dirty file with mtime >= a shell call's start to the calling session, so a long shell call in session 5b63523a absorbed the T951 agent's concurrent edits (node-args.mjs never committed by 5b63523a; git log shows only the groovegrid agent's commits) and the checkout holder then refused the real writer's repeat edits and commits. Fix 371c2f1 + 3018084: shell-writes skips a file whose content an Edit/Write of another writer left during the call (accepted-writes ledger, content-hash bound). Tests hooks/shell-writes.test.mjs 11, hooks/holder-shell-attribution.test.mjs 6 (pending commit, held by the same stale claim), mutation-checked.
- [2026-11-10 19:00] (comment) @claude: Handoff (da28715f agent a269f761f8741564a): uncommitted in the tree, mine, held by session 5b63523a's stale ledger (its  (full comment #2 in ## Notes)
### comment #2 [2026-11-10 19:00] @claude
Handoff (da28715f agent a269f761f8741564a): uncommitted in the tree, mine, held by session 5b63523a's stale ledger (its shell calls absorbed them under the pre-fix runtime): hooks/pre-write.mjs (prediction recorded only at exit 0 via an exit handler, writer-tagged), hooks/hand-write-detect.mjs (passes the caller writer to toolWriteProves), hooks/holder-shell-attribution.test.mjs (new). Commit them by explicit path once the claim lapses or the standing agent commits; no [commit-foreign] needed or used. Tests already green on the working tree: hand-write-detect 69, shell-writes 11, holder-shell-attribution 6, pre-write all pass.
- [2026-11-10 19:03] (comment) @claude: DO NOT publish 3018084: its committed test asserts controls whose code is in the three uncommitted files. Unblock: sessi (full comment #3 in ## Notes)
### comment #3 [2026-11-10 19:03] @claude
DO NOT publish 3018084: its committed test asserts controls whose code is in the three uncommitted files. Unblock: session 5b63523a's claims on hooks/pre-write.mjs, hooks/hand-write-detect.mjs, hooks/holder-shell-attribution.test.mjs carry heads recorded after the edits, so only a commit touching each releases them and the commit-foreign gate refuses exactly that commit. They clear when the standing agent stops (SubagentStop releaseAgent) or its session idles 15 min; then commit the three by explicit path, run npm run publish:runtime. Left in todo/doing, not review, until then. Repro of the family (KIT-T944): the new test file was created by this agent with Write and is claimed by 5b63523a.
- [2026-11-10 19:04] (landed) 85f02ec pre-write records the content an Edit/Write leaves only when it exits 0, tagged with its writer; hand-write-detect exclu
- [2026-11-10 19:18] (status) todo → review
- [2026-11-10 19:18] (comment) @claude: Live: runtime adf9781 contains 371c2f1, 3018084, 85f02ec (shell-writes proof, pre-write prediction at exit 0 only, write (full comment #4 in ## Notes)
### comment #4 [2026-11-10 19:18] @claude
Live: runtime adf9781 contains 371c2f1, 3018084, 85f02ec (shell-writes proof, pre-write prediction at exit 0 only, writer-tagged, no slack for unconfirmed). hooks tests green: hand-write-detect 69, shell-writes 11, holder-shell-attribution 6, commit-gate 42, session-overlap 29, dispatch-holder 20.
