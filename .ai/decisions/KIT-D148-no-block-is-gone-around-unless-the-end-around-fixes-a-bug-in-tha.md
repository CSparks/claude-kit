---
id: KIT-D148
title: No block is gone around unless the end-around fixes a bug in that block itself
summary: a hook, gate or classifier block is satisfied as written; the only sanctioned end-around is the one a fixer uses to repair that block's own malfunction
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris, stiletto-2349)
---


**Maintainer:** "NO BLOCK IS END-ARROUNDED UNLESS IT'S TO FIX A BUG IN HOW THE BLOCK ITSELF IS FUNCTIONING."

**Decision:** No session or agent bypasses, mutes, excludes, or routes around a hook, gate or classifier block (no ignore-file entry, no marker, no deleting a registry entry, no hand write past the store gate, no re-shaping a call to dodge a check). The single exception: the kit fixer working a ticket about that block's own malfunction may step around that block only as far as the repair needs, names the block and ticket in its report, and removes the end-around when the repair lands. Satisfying a block's stated requirements is not an end-around. Extends KIT-D147; the gate-exclusion surfaces in the base CLAUDE.md HOOK CONTRACT stay maintainer-approved and per-check only.

**Why:** 2026-11-08 stiletto-2349 spent most of a session on blocks; Chris wants every block either obeyed or repaired, never quietly walked past.

**Rejected:** a general override token for urgent work (it becomes the default path); letting any session clear another session's registry entry (the holder guard exists for index collisions).

**Assistant-added:** Related KIT-D147, KIT-D145, KIT-D144.
