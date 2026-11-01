---
id: KIT-D126
title: The kit serves the maintainer; no rule, hook or receipt hands him a chore Claude can do or narrates housekeeping at him
summary: The kit exists so the maintainer never repeats himself and Claude has the tools for project flow. Hooks and receipts resolve housekeeping silently (stale citations, bookkeeping anchors, closes) and never relay it to him.
date: 2026-11-01
supersedes: 
source: Chris 2026-11-01, marblequest session; recorded there as MAR-D011
---



**Decision:** No kit rule, hook or receipt may hand the maintainer work Claude can do itself (closing tickets, running /done, re-anchoring stale citations, relaying hook noise). Housekeeping is handled silently, not narrated to him. Audit scope: human_only done and "run /done" prompts, flush.mjs citation checks that flag another project's paths, and the Stop-hook anchor nag after a bookkeeping-only turn.

**Maintainer:** Chris, 2026-11-01 (MAR-D011): "KIT exists for ME to not have to repeat myself and for you to have the fucking tools for project flow, not to introduce superfluous process for me."

**Why:** Promoted from MAR-D011. The kit's job is the maintainer's flow; process aimed at him defeats it.

**Rejected:** leaving nags in place as safety nets. A nag that asks the maintainer to act is the process this decision removes.
