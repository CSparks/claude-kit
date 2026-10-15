---
id: KIT-T510
title: publish:runtime tests and copies the WORKING TREE, so one writer's uncommitted work blocks another writer's publish in the unbrokered claude-kit checkout (2026-10-15: KIT-T509 WIP in hooks/pre-write.mjs turned npm test red, holding dirt-empire's pushed 8e34bcf unpublished). Publish should export and test committed HEAD (git archive into the runtime dir, run the suite there), never the working tree; per Chris, kit work is never blocked
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T15:16:54Z
updated: 2026-10-15T15:35:56Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T486, KIT-T509, KIT-T482

## History
- [2026-10-15 15:16] (created) bug — publish:runtime tests and copies the WORKING TREE, so one writer's uncommitted work blocks another writer's publish in the unbrokered claude-kit checkout (2026-10-15: KIT-T509 WIP in hooks/pre-write.mjs turned npm test red, holding dirt-empire's pushed 8e34bcf unpublished). Publish should export and test committed HEAD (git archive into the runtime dir, run the suite there), never the working tree; per Chris, kit work is never blocked
- [2026-10-15 15:35] (comment) @claude: publish:runtime exports HEAD to a scratch dir and runs npm test there; scripts/runtime-publish.test.mjs (dirty file outside HEAD neither fails nor leaks; red verify leaves current)
- [2026-10-15 15:35] (status) todo → review
