---
id: KIT-T347
title: q gap: a grep followed an empty q sym for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T14:47:47Z
updated: 2026-10-20T00:53:36Z
fixed_commit: b6dd07f
---

## Description
q: q sym Rng --type impl  then  grep: impl IntoMesh\|trait IntoMesh

kit-bug-shape: q-gap:grep-after-empty-q:sym
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 14:47] (created) bug — q gap: a grep followed an empty q sym for the same terms
- [2026-10-13 19:25] (comment) seen again in stiletto-2349: q: q sym aiPaths 2>&1 then grep: aiPaths
- [2026-10-18 17:49] (comment) seen again in dirt-empire: q: q sym pickup 2>&1 then grep: pickup
- [2026-10-19 00:44] (comment) seen again in dirt-empire: q: q sym FacetMesh --type struct impl 2>&1 then grep: pub fn\|pub struct\|pub const
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) same q-miss false positive as KIT-T470 (Rng vs IntoMesh); fixed in hooks/lib/q-miss.mjs
