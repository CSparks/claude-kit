---
id: KIT-D073
title: Big pushes dispatch on Opus 5.5; straightforward work on Opus 4.8
summary: New `push` tier -> claude-opus-5-5/high for large or spatially heavy builds; `standard` -> claude-opus-4-8/high for straightforward coding.
date: 2026-09-24
supersedes: KIT-D072 (the "no tier uses claude-opus-4-8" clause only; its scoped/ui rows stand)
source: conversation 2026-09-24 (Chris directive, Stiletto rig tool session)
---

**Decision:** Any new big push (a multi-file feature, new crate, spatially heavy geometry/rig
work) dispatches on `claude-opus-5-5` via the `push` tier. Straightforward coding returns to
`claude-opus-4-8` on the `standard` tier, run at effort high (4.8 degrades below high).
Both dispatch through agents whose frontmatter pins the full id.

**Why:** Chris, 2026-09-24, after a skeletal-rig build went out on 4.8: "I wanted that agent
to be running on Opus 5.5. That's fairly intense spatial stuff." then "Any new big pushes
should run on Opus 5.5. We can do straightforward stuff with 4.8."

Rejected: keeping Opus 5 as the default rung for everything (not what was asked).
