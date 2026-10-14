---
id: KIT-D095
title: The broker replaces the hand-off writer turn once its vetting run passes; a failing golden over the maintainer's uncommitted edits is already red
summary: after ST-T904 vetting every session on a checkout submits patches and no agent edits code by hand while the daemon runs (Chris still may); a golden that fails on Chris's uncommitted .rhai edits counts as foreign, never against the patch
date: 2026-10-14
supersedes: 
source: Chris 2026-10-14 ~14:30 CDT, questionnaire in session stiletto-2349-2a (captures inbox 2026-10-14-1911-*); KIT-T482 comments
---


**Decision:**
- **The broker replaces the writer turn.** Once the broker passes its vetting run (ST-T904), every session on a checkout submits patches to the broker daemon.
  - No agent edits code by hand while the daemon runs.
  - Chris may still edit by hand; the daemon pauses on his edits (dirty-tree hold).
- **Chris's uncommitted edits are already red.** A failing golden that reads one of Chris's uncommitted `.rhai` edits counts as already-red (foreign). It never blames the patch under test.

**Why:** the hand-off writer slot was held per queue, not per landing (one session held stiletto's slot ~21 h across a 5-lane queue), with no tool showing the queue or the hold's age, so every other session waited. A single daemon that batches, gates and lands patches serves every session without repo copies (KIT-D039). Blaming a patch for the maintainer's own work in progress would bounce good patches.

**Rejected:**
- Short holds of the writer slot alone: still one writer and a prose hand-off.
- Repo copies or worktrees per writer: ruled out by KIT-D039; about 500 GB of targets each.
