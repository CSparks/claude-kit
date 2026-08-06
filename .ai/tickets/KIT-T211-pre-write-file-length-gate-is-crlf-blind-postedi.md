---
id: KIT-T211
title: pre-write file-length gate is CRLF-blind: postEditLines matches LF payloads against raw CRLF disk text - fails open on growth, blocks shrinking edits
type: bug
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T19:00:01Z
updated: 2026-08-06T19:00:01Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] postEditLines matches and measures in LF space (CRLF disk + LF payload reconstructs the post-edit file)
- [x] Regression tests: CRLF growth blocks, CRLF shrink passes, LF control, replace_all path (hooks/pre-write.test.mjs, wired into npm test)

## Plan
1.

## History
- [2026-08-06 19:00] (created) bug — pre-write file-length gate is CRLF-blind: postEditLines matches LF payloads against raw CRLF disk text - fails open on growth, blocks shrinking edits
- [2026-08-06 19:06] (comment) criterion added: postEditLines matches and measures in LF space (CRLF disk + LF payload reconstructs the post-edit file)
- [2026-08-06 19:06] (comment) criterion added: Regression tests: CRLF growth blocks, CRLF shrink passes, LF control, replace_all path (hooks/pre-write.test.mjs, wired into npm test)
- [2026-08-06 19:07] (comment) ticked: postEditLines matches and measures in LF space (CRLF disk + LF payload reconstructs the post-edit file)
- [2026-08-06 19:07] (comment) ticked: Regression tests: CRLF growth blocks, CRLF shrink passes, LF control, replace_all path (hooks/pre-write.test.mjs, wired into npm test)
- [2026-08-06 19:07] (comment) @claude: Fix: postEditLines normalizes CRLF->LF for current/old/new before reconstruction (hooks/pre-write.mjs). Regression: hook (full comment #1 in ## Notes)
### comment #1 [2026-08-06 19:07] @claude
Fix: postEditLines normalizes CRLF->LF for current/old/new before reconstruction (hooks/pre-write.mjs). Regression: hooks/pre-write.test.mjs (5 asserts: CRLF growth blocks + names file-length, CRLF shrink passes, LF control, replace_all) wired into npm test; full suite exit 0. Found live by the ST-T138 split agent: the gate blocked shrinking edits to a 625-line CRLF file and failed OPEN on growth (KIT-T121 corridor mode, Windows-only). Bonus catch: the fixed gate immediately flagged scripts/test-hooks.mjs at 817 lines -> KIT-T212.
