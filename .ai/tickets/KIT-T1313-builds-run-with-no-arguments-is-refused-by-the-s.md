---
id: KIT-T1313
title: builds --run with no arguments is refused by the source-shell-write gate whose text is the generic Write-gate advice (Use the Write tool...)
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T16:04:13Z
updated: 2026-11-16T16:17:17Z
---

## Description
builds --run with no arguments is refused by the source-shell-write gate whose text is the generic Write-gate advice (Use the Write tool...), not the builds --run usage; the block names the arg rule only in its first line

kit-bug-shape: cap:bug:builds-run-with-no-arguments-is-refused-by-the-s:54f70810
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
A refused builds --run call (no arguments, unknown option, --out outside target/ and the scratchpad) printed the Write-tool advice. The block now ends with the launcher's usage form 'builds --run "<command>" --out <file> --timeout N --tool-timeout N' (LAUNCHER_USAGE in builds-run-args.mjs, advice paragraphs in lib/source-shell-advice.mjs); a real hand write keeps the Write advice. Tests: hooks/source-shell-gate-builds-run.test.mjs all pass (4 new), source-shell-gate, -wrapped, -delete, -escapes exit 0.

## History
- [2026-11-16 16:04] (created) bug — builds --run with no arguments is refused by the source-shell-write gate whose text is the generic Write-gate advice (Use the Write tool...)
- [2026-11-16 16:17] (status) todo → review
