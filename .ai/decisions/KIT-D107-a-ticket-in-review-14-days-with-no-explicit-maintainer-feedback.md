---
id: KIT-D107
title: A ticket in review 14+ days with no explicit maintainer feedback is closed automatically; a later description that collides with it reopens it
summary: Every project store closes a ticket that has sat in review for more than 14 days with no explicit maintainer feedback since it entered review. The close is marked lapsed, not accepted, so it stays findable. When the maintainer later describes something that collides with a lapsed ticket, that ticket is reopened rather than a duplicate filed.
date: 2026-10-27
supersedes: 
source: Chris 2026-10-27: 'If a ticket is in review for more than 2 weeks and I haven't given explicit feedback regarding it, it should be closed.' / 'If I describe something that collides with that ticket, it should be re-opened.'
---


**Decision:** A ticket in `review` for more than 14 days, with no explicit maintainer feedback recorded since it entered review, is closed automatically in every project store. The close is labelled `lapsed` with a history line citing this decision, so it is distinguishable from an accepted `done`. When the maintainer later describes something (capture, triage, or in conversation) that collides with a lapsed ticket, that ticket is reopened to `todo` and the new description is attached to it, instead of filing a duplicate.

**Why:** ~1,380 tickets sat in review across the projects (2026-10-27 standup), burying the few that need his attention. Silence for two weeks is the answer; a collision later is the signal it still matters.

**Rejected:** bulk-accepting as plain `done` (indistinguishable from real acceptance, so a collision could not find it); leaving review to grow.
