---
id: KIT-T733
title: source-shell-gate false positive on a read-only scratch script: FS_WRITE's WRITE_CALLS (rename|rm|unlink|link|cp|touch...) match prose insid
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T21:50:10Z
updated: 2026-10-30T21:52:24Z
---

## Description
source-shell-gate false positive on a read-only scratch script: FS_WRITE's WRITE_CALLS (rename|rm|unlink|link|cp|touch...) match prose inside a string literal ('t unlink (or replace)') and the script's quoted import path to a .mjs then reads as a source write; the command only read files. Seen 2026-10-30 running a scratchpad script that imported a kit module.

kit-bug-shape: cap:bug:source-shell-gate-false-positive-on-a-read-only-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: FS_WRITE WRITE_CALLS now require a leading dot (fs.rm(, p.unlink()), so prose inside a string no longer reads as a write. Evidence: hooks/source-shell-gate.test.mjs 125 passed (prose negative control + fs.rm control), shell-writes.test.mjs 7, store-shell-gate.test.mjs 35.

## History
- [2026-10-30 21:50] (created) bug — source-shell-gate false positive on a read-only scratch script: FS_WRITE's WRITE_CALLS (rename|rm|unlink|link|cp|touch...) match prose insid
- [2026-10-30 21:52] (status) todo → review
- [2026-10-30 21:52] (landed) a719628 Shell write pre-scan counts method calls only, so prose like 'unlink (or replace)' is no write; implements KIT-T733
