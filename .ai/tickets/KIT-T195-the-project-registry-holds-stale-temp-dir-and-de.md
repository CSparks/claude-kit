---
id: KIT-T195
title: the project registry holds stale temp-dir and dead-worktree entries, weakening the KIT-T164 registered-store guard
type: bug
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:16Z
updated: 2026-08-06T02:29:16Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> (bug) ~/.claude/claude-kit-projects.json holds stale entries that weaken the new
> KIT-T164 registered-store guard: `kit-budget-J2FaVP` → C:/Users/.../AppData/Local/Temp/
> kit-budget-J2FaVP (a TEMP dir — a fixture landing there with ids.key KIT could still
> clobber the live scope, exactly the hole T164 closed) and three groovegrid
> .claude/worktrees/agent-* entries (dead worktrees). Also `asset-forge` exists in
> claude-kit-data/projects but is NOT registered on this machine. Fix direction: registry
> hygiene pass — prune entries whose path no longer exists or lives under a temp/worktree
> dir (never auto-register those), register real data-repo projects, and consider an
> orient warning when registry and data-repo project sets diverge. Found 2026-08-04 after
> the phantom-scope cache rebuild. --priority high

Provenance: `.ai/inbox/triaged/2026-08-04-1937-registry-holds-stale-temp-and-worktree-entries.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] a registry entry whose path no longer exists, or lives under a temp/worktree dir, is reported by a hygiene pass
- [ ] nothing is pruned automatically — the pass proposes and the operator confirms
- [ ] asset-forge's unregistered-but-present store is surfaced by the same pass

## Plan
1.

## History
- [2026-08-06 02:29] (created) bug — the project registry holds stale temp-dir and dead-worktree entries, weakening the KIT-T164 registered-store guard
- [2026-08-06 02:30] (comment) criterion added: a registry entry whose path no longer exists, or lives under a temp/worktree dir, is reported by a hygiene pass
- [2026-08-06 02:30] (comment) criterion added: nothing is pruned automatically — the pass proposes and the operator confirms
- [2026-08-06 02:30] (comment) criterion added: asset-forge's unregistered-but-present store is surfaced by the same pass
