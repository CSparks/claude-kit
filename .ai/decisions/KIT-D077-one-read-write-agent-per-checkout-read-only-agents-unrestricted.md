---
id: KIT-D077
title: One read/write agent per checkout; read-only agents are unrestricted
summary: The dispatch gate counts only read/write agents, keyed by the checkout they write in; parallel-dispatch is removed; [read-only:] and [tree:] prompt tokens declare research and target checkout.
date: 2026-09-30
supersedes: KIT-D074 (the any-tree, Rust-wide one-writer gate `parallel-dispatch` of KIT-T256); the one-checkout-on-main rule stands
source: conversation 2026-09-30 (maintainer: "That gate should not exist. It's one read/write agent per checkout. Read-only and research agents should be allowed.")
---

**Decision:**
1. The invariant is exactly one read/write agent per checkout. Read-only dispatches never count and are never blocked.
2. Read-only = built-in Explore/Plan/claude-code-guide, or a definition (plugin, project, superproject, user) whose `tools:` grants no Edit/Write/NotebookEdit/MultiEdit and no `*`; or a `[read-only: <reason>]` prompt token, logged as `readOnly` on the agents.jsonl row. Unknown and all-tools types are writers.
3. The count is keyed by the checkout the agent writes in: `[tree: <absolute path>]` in the prompt, else a repo root the brief names, else the session checkout. Writers in different checkouts never conflict.
4. `parallel-dispatch` is removed; `shared-tree-dispatch` is the one check. `[maintainer-asked-parallel: <his words>]` still lifts it for two writers in one checkout.
5. The kit ships `researcher-sonnet55` (claude-sonnet-5-5, read-only tools) as the pinned Sonnet research lane.

**Why:** A research dispatch from one repo was blocked by a writer in another, and by a writer-capable type used for reading. The cost the gate priced (edit, build, contend on one HEAD) only exists between writers in one checkout.
