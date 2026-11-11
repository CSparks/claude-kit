---
id: KIT-T966
title: pre-write magic-numbers check flags numbers inside a doc-comment line when an Edit's old/new string starts mid-comment (no opening /** in th
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:58:03Z
updated: 2026-11-11T02:29:44Z
fixed_commit: a19f1fa
---

## Description
pre-write magic-numbers check flags numbers inside a doc-comment line when an Edit's old/new string starts mid-comment (no opening /** in the snippet): the snippet is judged as code. Repro: Edit a ' * ... 0..255 ...' line inside a /** block without including the /** line -> BLOCKED; including the /** line passes

kit-bug-shape: cap:bug:pre-write-magic-numbers-check-flags-numbers-insi
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] An Edit fragment starting inside a block comment is judged as comment text by pre-write magic-numbers; numerics in code still block

## Plan
1.

## History
- [2026-11-10 18:58] (created) bug — pre-write magic-numbers check flags numbers inside a doc-comment line when an Edit's old/new string starts mid-comment (no opening /** in th
- [2026-11-11 02:21] (comment) criterion added: An Edit fragment starting inside a block comment is judged as comment text by pre-write magic-numbers; numerics in code still block
- [2026-11-11 02:22] (landed) a19f1fa hand-write-detect: a file git put back is no hand write (content equal to HEAD, or an earlier Edit's content in a call t
- [2026-11-11 02:29] (status) todo → review
- [2026-11-11 02:29] (comment) Fixed in a19f1fa (+7c947bb test fix); runtime publish refused: exported HEAD red on hooks/claim-release-controls.test.mjs (imports uncommitted hooks/lib/live-claims.mjs, KIT-T944 residual awaiting maintainer approval), so current has not moved
- [2026-11-11 02:30] (comment) ticked: An Edit fragment starting inside a block comment is judged as comment text by pre-write magic-numbers; numerics in code still block
