---
id: KIT-D108
title: New greenfield work gets its first pass from Opus via the greenfield job; follow-up fixes fall back to the fix row
summary: The capability table carries a greenfield job routed to opus and marked self-escalating, so dispatch-guard accepts [job: greenfield] on opus with no [escalate:] or [model-override:]. Follow-up fixes dispatch as the normal fix job on sonnet.
date: 2026-10-28
supersedes: 
source: Chris 2026-10-28: 'ANy new greenfield stuff gets the first pass with Opus.' (dirt-empire DE-D057)
---


**Decision:** `.ai/config.yml` dispatch.jobs gains `greenfield` (family opus, effort high, `self_escalating: true`, evidence 2026-10-28). A new system or feature with no existing code to extend dispatches its first implementation pass as `[job: greenfield]` on opus; the dispatch-escalation gate passes a self-escalating row without `[escalate:]` and the job gate passes opus without `[model-override:]`. Follow-up fixes on that work dispatch as `[job: fix]` on sonnet.

**Why:** Opus produces the stronger first design on greenfield work; the maintainer asked for it by name, so the guard must not force escape tags for a request he made.

**Rejected:** routing greenfield through `build` with `[escalate:]` on every dispatch (the tag then carries no information); changing the default job for any ticket type.
