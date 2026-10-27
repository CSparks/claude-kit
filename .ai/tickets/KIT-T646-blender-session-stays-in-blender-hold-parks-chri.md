---
id: KIT-T646
title: Blender-session 'stays in Blender' hold parks Chris's decisions in .blend text blocks outside .ai: front geometry/rake/fork-travel decisions
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T03:51:22Z
updated: 2026-10-27T22:07:08Z
---

## Description
Blender-session 'stays in Blender' hold parks Chris's decisions in .blend text blocks outside .ai: front geometry/rake/fork-travel decisions of 2026-10-20/22 lived only in pending_repo_changes.txt until 2026-10-26 (recorded DE-D052), and an export agent nearly scaled the model to the stale 1.48 m physics; root cause: the hold rule forbids tickets/files during live modelling but has no carve-out for DECISIONS, contradicting 'decisions go in DECISIONS the turn they happen'

kit-bug-shape: cap:bug:blender-session-stays-in-blender-hold-parks-chri
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
2026-10-27 NOT FIXED, needs the maintainer. Root cause located: the hold rule is Chris's own feedback memory C:/Users/Chris Sparks/.claude/projects/D--dev-dirt-empire/memory/blender-session-stays-in-blender.md (2026-10-20, 'a rule that must be enforced'): 'do NOT log tickets/comments/session lines for incremental model changes', with no carve-out for decisions, which contradicts the global rule 'decisions go in DECISIONS the turn they happen'. It is a memory file outside the kit and states a directive Chris called enforceable, so the kit writer did not edit it. Proposed amendment for Chris to accept (one paragraph appended to that memory): 'Exception: a decision Chris states during the session (a dimension, a geometry choice, a contract with the game such as axle position or fork travel) is recorded with one t decide the turn he says it. The hold covers tickets, session lines and files for incremental model changes, not decisions.' If accepted: apply it to the memory file (and to the same rule in any other project's Blender memory); no kit code change is involved. Decision needed: accept / reword the carve-out.
### comment #1 [2026-10-27 22:07] @claude
Chris 2026-10-27, ruling: NOT a bug, no carve-out. Work inside an open Blender file is direct edits Chris saves himself; it depends on him being there with Blender open, so it is out of bounds for the store. Filing each change to an open .blend is waste. The Blender hold rule stands unchanged.

## History
- [2026-10-27 03:51] (created) bug — Blender-session 'stays in Blender' hold parks Chris's decisions in .blend text blocks outside .ai: front geometry/rake/fork-travel decisions
- [2026-10-27 22:07] (comment) @claude: Chris 2026-10-27, ruling: NOT a bug, no carve-out. Work inside an open Blender file is direct edits Chris saves himself; (full comment #1 in ## Notes)
- [2026-10-27 22:07] (status) todo → superseded
