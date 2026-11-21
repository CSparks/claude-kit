---
id: KIT-D177
title: A part he has said works is frozen: fix only the broken part, never rewrite the working one
summary: When he says a part works it is frozen; fix only the broken part; never rewrite, replace or improve the working part in the same change.
date: 2026-11-21
supersedes: 
source: conversation 2026-06-17, Marble Race project; promoted to every project 2026-11-21
implemented_by: KIT-T1463
no_work: 
---


**Decision:** When the maintainer says a specific part works, that part is frozen. Fix only the broken part; never rewrite, replace or improve the working part in the same change. A rewrite that discards a working piece to fix a separate problem is a regression even when the new code is cleaner or fixes the target bug. Find the smallest change that fixes the reported defect and leave everything else byte-identical. Before a rewrite, ask whether the working part can stay and only the broken seam change; default to surgical, not wholesale. A green metric is not proof: verify the metric exercises the thing in question, because a test that can pass while the feature is broken is not verification.

**Why:** in the Marble Race project the spreading tubes worked and only the merge-back at the end was broken; rewriting the whole feature regressed the spread into two unreachable side tubes, and the simulation's finish rate was a false pass because the marbles never reached them.

**Assistant-added:** (unconfirmed) no verbatim words of the maintainer are recorded in the source for this rule; it is carried as his ruling of 2026-06-17 as the project recorded it. Origin: Marble Race decision MGP-D006, promoted to every project by his approval of a questionnaire on 2026-11-21.
