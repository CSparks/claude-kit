---
id: KIT-D100
title: A capability row may rest on the maintainer's quoted decision (grade M); asset stays opus and plan stays opus with fable as fallback
summary: Chris 2026-10-21 re-dated asset (opus) and confirmed plan (opus, fable fallback); a row resting on a dated, quoted maintainer decision re-dates through job-capability.mjs decide, so it no longer goes stale and blocks every dispatch
date: 2026-10-21
supersedes: KIT-D091
source: Chris 2026-10-21 (AskUserQuestion answers, relayed by the coordinator); research/models-capability-2026-10-21.md; scripts/job-capability.mjs decide
---


**Decision:**
- `asset` stays opus. Chris: "(Recommended) Re-date asset, keep opus". The re-date rests on his decision, not on source evidence (spatial and geometry work has none on any model).
- `plan` stays opus with fable as `fallback`. Chris: "(Recommended) Plan to opus, fable fallback". This is the proposal held in research/models-capability-2026-10-17.md and the row KIT-D098 applied; D091's "fable plans" is superseded.
- A row may rest on grade M: a `Basis` cell `M (<who> <YYYY-MM-DD>: "<quote>")` in the dated research note. A bare `M` with no date is not graded. `node scripts/job-capability.mjs decide <date> <job> --by <who> --on <date> --quote "<his words>"` writes that row and re-dates the job.

**Why:** the capability gate refused to re-date a row with no A/B/C source, and the table is blocking, so a row that rests on a maintainer decision went stale every 7 days and blocked every Agent dispatch in every repo (2026-10-20). The decision is the evidence for such a row; the note records his words and date so it stays auditable.

**Rejected:**
- Re-dating the config by hand: skips the gate the note exists for.
- Exempting M rows from staleness: a decision from months ago is still a dated fact the weekly review should see.
