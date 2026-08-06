---
id: KIT-T206
title: Opus 5 dispatches drop an effort notch — standard tier low, opus fallback medium, kit agents pin effort: low
type: tech-debt
status: done
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T16:01:39Z
updated: 2026-08-06T16:12:12Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] config.yml dispatch.tiers: standard = opus/low; deep opus fallback documented at medium
- [x] All 7 opus-pinned kit agents pin effort: low in frontmatter
- [x] Superseding decision recorded (KIT-D060)

## Plan
1.

## History
- [2026-08-06 16:01] (created) tech-debt — Opus 5 dispatches drop an effort notch — standard tier low, opus fallback medium, kit agents pin effort: low
- [2026-08-06 16:01] (comment) criterion added: config.yml dispatch.tiers: standard = opus/low; deep opus fallback documented at medium
- [2026-08-06 16:01] (comment) criterion added: All 7 opus-pinned kit agents pin effort: low in frontmatter
- [2026-08-06 16:01] (comment) criterion added: Superseding decision recorded (KIT-D060)
- [2026-08-06 16:01] (status) todo → doing
- [2026-08-06 16:12] (comment) ticked: config.yml dispatch.tiers: standard = opus/low; deep opus fallback documented at medium
- [2026-08-06 16:12] (comment) ticked: Superseding decision recorded (KIT-D060)
- [2026-08-06 16:12] (comment) @claude: [no-test: config values + agent frontmatter pins; honored by the orchestrator at dispatch, no executable surface] Applie (full comment #1 in ## Notes)
### comment #1 [2026-08-06 16:12] @claude
[no-test: config values + agent frontmatter pins; honored by the orchestrator at dispatch, no executable surface] Applied to kit config, 7 agents, stiletto + inv4d3rs configs; jollys-vinyl drift capped separately; KIT-D060 recorded
- [2026-08-06 16:12] (status) doing → done
- [2026-08-06 16:12] (comment) ticked: All 7 opus-pinned kit agents pin effort: low in frontmatter
