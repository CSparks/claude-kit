---
id: KIT-T843
title: q gap: 'code' has no --glob flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T22:46:04Z
updated: 2026-11-03T01:27:39Z
---

## Description
q code broker\.[a-z_]+ --regex -o --path scripts --glob *.mjs

kit-bug-shape: q-gap:flag:code:--glob
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code --glob G (also -g, --include; repeatable; !G drops) keeps only matching paths; code-index 28 passed

## Plan
1.

## Notes
Added --glob/-g/--include to q code and sym (code-index-query.mjs excluder; globs match path or basename; ! negates); help in q-help.mjs; test in code-index.test.mjs (code-index 28, q-gaps 13, q-path-outside 4).

## History
- [2026-11-02 22:46] (created) bug — q gap: 'code' has no --glob flag
- [2026-11-03 01:27] (comment) criterion added: q code --glob G (also -g, --include; repeatable; !G drops) keeps only matching paths; code-index 28 passed
- [2026-11-03 01:27] (comment) ticked: q code --glob G (also -g, --include; repeatable; !G drops) keeps only matching paths; code-index 28 passed
- [2026-11-03 01:27] (status) todo → review
- [2026-11-03 01:27] (landed) 015e9b0 q code and sym take --glob (-g, --include; repeatable, !G drops): keeps only matching paths, a no-slash glob also matche
