---
id: KIT-T1270
title: process failure (road-generator houses agent a70f54bfd9ae58e5d, RDG-T081): ran 'git pull --rebase --autostash origin main' in the shared rap
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T1266
created: 2026-11-15T18:01:03Z
updated: 2026-11-15T18:01:03Z
---

## Description
process failure (road-generator houses agent a70f54bfd9ae58e5d, RDG-T081): ran 'git pull --rebase --autostash origin main' in the shared rapid-game checkout after every commit; at 9d26fb36 (~11:11) it created autostash 4a49819e, the rebase refused on unstaged changes, re-applying the stash conflicted and five agents' uncommitted work was left in stash@{0}. Root cause: autostash in a multi-writer checkout stashes OTHER writers' files; no gate refuses it. Prevention: a commit/push gate that refuses 'git pull --autostash' / 'git stash' in a checkout with another live writer's uncommitted files, and briefs that name 'git pull --rebase' only on a clean tree (fetch + 'git rebase' after committing own paths, else 'git pull --no-rebase').

kit-bug-shape: cap:bug:process-failure-road-generator-houses-agent-a70f:728b2c2d
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-15 18:01] (created) bug — process failure (road-generator houses agent a70f54bfd9ae58e5d, RDG-T081): ran 'git pull --rebase --autostash origin main' in the shared rap
- [2026-11-15 18:03] (status) todo → superseded (by KIT-T1266)
