---
id: KIT-D076
title: Straightforward fixes dispatch on Sonnet 5.5; opus and fable orchestrate
summary: `standard` tier -> claude-sonnet-5-5/high for straightforward fixes; opus and fable remain the orchestrator models.
date: 2026-09-30
supersedes: KIT-D073 (the `standard` -> claude-opus-4-8 row only; its `push` row stands), KIT-D043 (sonnet off the coding ladder)
source: conversation 2026-09-30 (Chris directive, stiletto session reviewing Astra's work)
---

**Decision:** Straightforward fixes dispatch on `claude-sonnet-5-5` via the `standard` tier,
through an agent whose frontmatter pins the full id (`sonnet55`). Big pushes stay on
`claude-opus-5-5` (`push`). Opus and fable remain the orchestrator (main-thread) models.

**Why:** Chris, 2026-09-30: "Going forward sonnet 5.5 handles straightforward fixes." then
"Opus and fable will remain orchestrator models."
