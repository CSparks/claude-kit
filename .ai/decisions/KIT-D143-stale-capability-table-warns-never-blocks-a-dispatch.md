---
id: KIT-D143
title: Stale capability table warns, never blocks a dispatch
summary: dispatch-guard capability-table-stale (KIT-T339) becomes a warning on every dispatch; age alone never stops delegation
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
---


**Maintainer:** "Stale-table goes warn only."

**Decision:** The capability-table-stale check in hooks/dispatch-guard.mjs (KIT-T339) no longer blocks. When the table's oldest evidence is past dispatch.refresh_days or a newer known model is missing, the dispatch proceeds and stderr carries a WARNING naming the refresh script. The exclusion id capability-table-stale still silences it.

**Why:** The 2026-11-08 architecture audit found that the block stops every dispatch in every adopted project, read-only agents included, on a calendar timer: the table's oldest row (2026-11-04) would have frozen all delegation around 2026-11-11. A stale table is a reason to refresh, not to stop work.

**Rejected:** keeping the block (halts all delegation on a date, not on a defect); a longer refresh_days (moves the cliff, keeps it).

**Assistant-added:** Related KIT-T339, KIT-D080.
