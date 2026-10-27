---
id: KIT-T430
title: q: --not-path / exclude globs to drop paths (e.g. tests) from q code/sym results; an analyst fell back to grep twice for lack of it (2026-10
type: feature
status: done
priority: medium
milestone:
labels: [kit-feature, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T20:22:20Z
updated: 2026-10-27T22:27:25Z
---

## Description
q: --not-path / exclude globs to drop paths (e.g. tests) from q code/sym results; an analyst fell back to grep twice for lack of it (2026-10-12)

kit-bug-shape: cap:feature:q-not-path-exclude-globs-to-drop-paths-e-g-tests
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code/sym/file take --not-path <glob|dir>, repeatable, also --not-path=VALUE (scripts/code-index-query.mjs)
- [x] tests: scripts/code-index.test.mjs ('--not-path drops globs and directories...', 23 passed)

## Plan
1.

## History
- [2026-10-12 20:22] (created) feature — q: --not-path / exclude globs to drop paths (e.g. tests) from q code/sym results; an analyst fell back to grep twice for lack of it (2026-10
- [2026-10-12 21:23] (status) todo → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
