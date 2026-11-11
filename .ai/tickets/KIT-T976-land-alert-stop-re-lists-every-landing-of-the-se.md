---
id: KIT-T976
title: land-alert (Stop) re-lists every landing of the session each time it fires, including landings the orchestrator already announced by sha and
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T19:30:14Z
updated: 2026-11-10T19:30:14Z
---

## Description
land-alert (Stop) re-lists every landing of the session each time it fires, including landings the orchestrator already announced by sha and link in earlier replies (dirt-empire 2026-11-10: 16 listed when 1, 10d57b5, was new). It should list only landings not yet named by sha in a prior assistant reply, so a real unannounced landing stands out.

kit-bug-shape: cap:bug:land-alert-stop-re-lists-every-landing-of-the-se
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
land-alert lists only landings whose sha no earlier assistant reply of the session named (7-40 hex prefix match; the reply being judged is excluded). New hooks/lib/announced-landings.mjs; hooks/land-alert.test.mjs 21 passed (new: named earlier not listed, new listed, all named silent, never-announced control, sha only in the judged reply still alerts).

## History
- [2026-11-10 19:30] (created) bug — land-alert (Stop) re-lists every landing of the session each time it fires, including landings the orchestrator already announced by sha and
