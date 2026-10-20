---
id: KIT-T470
title: q gap: a grep followed an empty q fts for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T05:31:57Z
updated: 2026-10-20T00:53:33Z
fixed_commit: b6dd07f
---

## Description
q: q fts flake pin.test control.test model-tag --project claude-kit 2>&1  then  grep: ^BUDGET|left:|test result

kit-bug-shape: q-gap:grep-after-empty-q:fts
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 05:31] (created) bug — q gap: a grep followed an empty q fts for the same terms
- [2026-10-14 07:27] (comment) seen again in stiletto-2349: q: q fts "template red" 2>&1 then grep: template
- [2026-10-14 18:33] (comment) seen again in stiletto-2349: q: q fts writer slot parallel broker 2>&1 then grep: WRITER SLOT\|slot free\|blocked\|waiting
- [2026-10-14 18:35] (comment) seen again in stiletto-2349: q: q fts broker build 2>&1 then grep: ^broker
- [2026-10-16 20:17] (comment) seen again in stiletto-2349: q: q fts "submodule lock lane" then grep: held by lane
- [2026-10-19 02:10] (comment) seen again in dirt-empire: q: q fts "suite time minutes slow test" 2>&1 then grep: suite
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) q-miss no longer files a ticket when the grep shares under half its terms with the empty q (hooks/lib/q-miss.mjs); test hooks/search-telemetry.test.mjs (22 passed)
