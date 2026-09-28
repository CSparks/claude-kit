---
id: KIT-D075
title: Parallel writers and worktrees need the maintainer's quoted words; read-only lanes are agent TYPES
summary: [allow-parallel] and [shared-tree-ok] retire; parallel writers need [maintainer-asked-parallel: <his words>]; read-only agents run alongside by definition (kit analyst / analyst-max); worktree dispatch blocks in every project.
date: 2026-09-28
supersedes: KIT-D074 (extends its enforcement; the one-checkout rule stands); the [allow-parallel] cost escape of KIT-T256
source: conversation 2026-09-28 (Chris's rulings on the KIT-D074 flags, via the coordinator)
---

**Decision:**
1. An agent can no longer grant itself parallel writers. In a Rust workspace a second writing
   agent needs `[maintainer-asked-parallel: <his words>]`; the same token is the only way past
   `shared-tree-dispatch`. `[allow-parallel: …]` and `[shared-tree-ok: …]` are retired.
2. Read-only work runs alongside a writer only as a read-only agent TYPE — a definition whose
   `tools:` grant no Edit/Write/NotebookEdit and whose body forbids mutating commands. The kit
   ships `analyst` and `analyst-max` (claude-opus-5-5, effort high / max) for this; Chris: "read
   only agents need their own agent definitions".
3. Worktree-isolated dispatch blocks in every adopted project, not only Rust; escape only
   `[maintainer-asked-worktree: <his words>]`.
4. The build broker and `broker-worker` skill stay as they are pending his decision (KIT-T276).

**Why:** Self-written escape notes let an agent reopen what the maintainer closed. Tying the
read-only allowance to a reviewed agent definition makes the exemption structural instead of a
per-prompt claim.

Rejected: keeping the cost-stating `[allow-parallel]` escape (still self-granted); judging
read-only per prompt.
