---
id: KIT-T1401
title: source-shell-write gate tells a subagent to delete a tracked file with 'git rm -- <path>', which stages the deletion in the shared index; an
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T21:38:37Z
updated: 2026-11-18T23:16:30Z
---

## Description
source-shell-write gate tells a subagent to delete a tracked file with 'git rm -- <path>', which stages the deletion in the shared index; another agent's commit (512eab6, RDG-T066) swept it up while the RDG-D129 agent was still editing, leaving 512eab6 and d65e7a7 unbuildable (owner_shot/sections.rs still named documents.rs until 1e34381). Root cause: staged state persists across tool calls in a multi-writer checkout. Prevention: the gate should name a delete-and-commit-in-one-call form (git rm -- <p> && git commit -- <p> ...) or the commit gate should refuse a commit that carries staged paths another live agent staged.

kit-bug-shape: cap:bug:source-shell-write-gate-tells-a-subagent-to-dele:cba465a5
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a removal a shell call makes is claimed for the agent that ran it, so another agent's commit that would take the staged deletion is refused by name while explicit-path commits and the deleter's own commit pass; the tracked-file delete guidance says to commit a git rm at once by explicit path (hooks/commit-staged-delete.test.mjs)

## Plan
1.

## Notes
Root cause: a `git rm` stays staged in the index every writer of a checkout shares. hooks/shell-writes.mjs credited a shell call's removals to the session ledger (KIT-T1110), so the session-level foreign check (KIT-T407) saw the deletion as the session's own, and the per-writer claim check (KIT-T1256, lib/commit-agent-claims.mjs) knew nothing of it: claims were recorded only for Edit and Write. Another agent of the same session then committed the whole index (`git add <own file> && git commit`) and took the deletion under its message (512eab6), leaving that commit and the next (d65e7a7) unbuildable.

Design chosen (the smaller of the two): the removal a shell call makes is also claimed for the agent that ran it, in shell-writes.mjs's PostToolUse, beside the ledger entry it already wrote. The existing claim check then refuses another writer's commit that would take the deletion, naming the file and the deleter, and its message already offers the explicit-path commit of the writer's own files. The deleter's own commit and every commit by explicit path pass. The claim ends when a commit takes the file (committedSince) or the agent stops. The delete guidance for a tracked file now also says to commit the `git rm` at once by explicit path, since the deletion otherwise sits in the shared index.

KIT-T1392 check: the claim check judges only the paths a commit takes and only standing claims of other writers; a path-scoped add/commit that leaves the deletion out is untouched (commit-foreign-newdir's KIT-T1392 cases still pass).

Tests: hooks/commit-staged-delete.test.mjs all pass (the git rm through the gate and shell-writes; another agent's whole-index commit refused naming src/documents.rs and aDeleter, with the explicit-path form offered; its explicit-path commit passes; the deleter's own commit passes; the tracked-file guidance); commit-foreign-newdir 27, commit-agent-claims 14, claims-release-verb, shell-writes 15, source-shell-gate-delete 63, source-shell-gate 168.

## History
- [2026-11-18 21:38] (created) bug — source-shell-write gate tells a subagent to delete a tracked file with 'git rm -- <path>', which stages the deletion in the shared index; an
- [2026-11-18 23:16] (status) todo → doing
- [2026-11-18 23:16] (comment) criterion added: a removal a shell call makes is claimed for the agent that ran it, so another agent's commit that would take the staged deletion is refused by name while explicit-path commits and the deleter's own commit pass; the tracked-file delete guidance says to commit a git rm at once by explicit path (hooks/commit-staged-delete.test.mjs)
- [2026-11-18 23:16] (comment) ticked: a removal a shell call makes is claimed for the agent that ran it, so another agent's commit that would take the staged deletion is refused by name while explicit-path commits and the deleter's own commit pass; the tracked-file delete guidance says to commit a git rm at once by explicit path (hooks/commit-staged-delete.test.mjs)
