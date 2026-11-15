---
id: KIT-T1256
title: process failure (RDG-T057 terrain agent): git commit by explicit 'git add -- <my paths>' swept in files ANOTHER agent had already staged in
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T11:18:44Z
updated: 2026-11-15T11:31:00Z
---

## Description
process failure (RDG-T057 terrain agent): git commit by explicit 'git add -- <my paths>' swept in files ANOTHER agent had already staged in the shared index (rdg-world roads.rs, one_road_system tests, the rapid-game gitlink): demo commit b000e49 carries their work under my message and moved the pin. Root cause: several agents share one git index; 'git add' of my paths does not unstage theirs, and I committed without checking 'git diff --cached --stat' showed only my paths. Prevention: commit with 'git commit -F <msg> -- <my paths>' (pathspec commit takes only those paths), or a commit gate that refuses a commit whose staged set holds files another live agent last wrote

kit-bug-shape: cap:bug:process-failure-rdg-t057-terrain-agent-git-commi:08eb135c
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built in the commit gate (hooks/commit-gate.mjs, hooks/lib/commit-agent-claims.mjs): a commit whose file set holds a path another live writer's standing claim covers (per-writer claims of checkout-holder, dirty and uncommitted since the claim) and the committing writer holds none is refused (exit 2), naming each path and its holder and the fix: git commit <-F file | -m> -- <own paths>, which leaves the other agents' staged work staged; git restore --staged is expressly not offered. [commit-foreign: reason] or the commit-foreign ignore key lifts it. Chosen over the toolwrites ledger because claims are per live agent and clear on commit or when the agent stops (a ledger entry never ages out of a day-old file); limit: an agent that has already stopped has released its claims, and a staged submodule gitlink carries no claim, so neither is judged (the pin that moved with b000e49 is not caught). Tests: hooks/commit-agent-claims.test.mjs 12 passed (two agents of one session); commit-gate 42, commit-foreign-moves 9, -newdir 24, -submodule 6, agent-claims, claim-release, holder-shell-attribution 0 failed.

## History
- [2026-11-15 11:18] (created) bug — process failure (RDG-T057 terrain agent): git commit by explicit 'git add -- <my paths>' swept in files ANOTHER agent had already staged in
- [2026-11-15 11:31] (status) todo → review
