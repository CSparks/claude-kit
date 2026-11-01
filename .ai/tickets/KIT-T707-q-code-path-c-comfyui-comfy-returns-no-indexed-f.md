---
id: KIT-T707
title: q code --path C:/ComfyUI/comfy returns 'no indexed file passes --path' from an unbounded session: the ComfyUI checkout (comfy-volta agent's
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T17:10:50Z
updated: 2026-11-01T23:23:16Z
---

## Description
q code --path C:/ComfyUI/comfy returns 'no indexed file passes --path' from an unbounded session: the ComfyUI checkout (comfy-volta agent's turf) is not in q's index, so the comfy-volta agent's 'search with q, never grep' rule cannot be followed there; agent fell back to grep on C:/ComfyUI core

kit-bug-shape: cap:bug:q-code-path-c-comfyui-comfy-returns-no-indexed-f
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Already fixed by 36efa38 (an absolute --path outside the index is scanned on demand, a missing one errors). Verified 2026-11-01: q code async --path D:/dev/dirt-empire/crates/race searched 60 files on demand; scripts/code-index.test.mjs 27 passed (absolute --path case). Review citing 36efa38.

## History
- [2026-10-29 17:10] (created) bug — q code --path C:/ComfyUI/comfy returns 'no indexed file passes --path' from an unbounded session: the ComfyUI checkout (comfy-volta agent's
- [2026-10-29 17:14] (landed) 36efa38 q code: an absolute --path outside the index is scanned on demand, a missing one errors (implements KIT-T707)
- [2026-11-01 23:18] (status) todo → doing
- [2026-11-01 23:23] (status) doing → review
- [2026-11-01 23:23] (landed) bee2e66 q code: a lone -- makes the next token search text; an empty q code says gitignored and out-of-repo trees are searched w
