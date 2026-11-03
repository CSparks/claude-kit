---
id: KIT-T847
title: q gap: a grep followed an empty q code for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T02:01:24Z
updated: 2026-11-03T16:31:44Z
---

## Description
q: q code "LUMA|RIG |panicked" --dir target/broker/logs --regex 2>&1  then  grep: ^(LUMA|RIG)|panicked|assertion|left:|right:

kit-bug-shape: q-gap:grep-after-empty-q:code
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] an empty --dir scan says why (no readable files; relative path resolves against cwd) and a cut-short scan says STOPPED; q-code-target 8 passed

## Plan
1.

## Notes
Not reproduced as a q fault: the same command now returns 696+ hits. Likely cause: run from a job checkout whose target/broker/logs exists but is empty (broker logs live in the main checkout), which printed '(no results: no indexed file passes the default kinds)' beside 'searched 0 files', reading as a q miss. An empty scan now says 'no readable files there (a relative --dir resolves against the current directory)' and a truncated scan says STOPPED. Same fixes as KIT-T848 apply (scan bounded).

## History
- [2026-11-03 02:01] (created) bug — q gap: a grep followed an empty q code for the same terms
- [2026-11-03 16:23] (status) todo → doing
- [2026-11-03 16:31] (comment) criterion added: an empty --dir scan says why (no readable files; relative path resolves against cwd) and a cut-short scan says STOPPED; q-code-target 8 passed
- [2026-11-03 16:31] (comment) ticked: an empty --dir scan says why (no readable files; relative path resolves against cwd) and a cut-short scan says STOPPED; q-code-target 8 passed
- [2026-11-03 16:31] (status) doing → review
