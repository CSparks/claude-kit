---
id: KIT-T686
title: broker: red-run limit per ticket: after 2 consecutive red results (failed/compile) on one ticket, submit refuses the next job for that ticke
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:28:01Z
updated: 2026-10-29T00:46:18Z
---

## Description
broker: red-run limit per ticket: after 2 consecutive red results (failed/compile) on one ticket, submit refuses the next job for that ticket until a diagnosis note is on the ticket (t notes) or --diagnosed is passed with the cause; dirt-empire 2026-10-28: DE-T188 80 jobs 34 red, 99 of 241 jobs red or stale

kit-bug-shape: cap:feature:broker-red-run-limit-per-ticket-after-2-consecut
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built: scripts/broker/red-run.mjs. writeResult counts final results per ticket (failed adds a red; passed/landed clears; stale and gate are not reds) into target/broker/redruns.json (shared by lanes), stamping a hash of the ticket's Notes at each red; buildPatchJob refuses a submit for a ticket with 2+ consecutive reds whose Notes hash is unchanged. Lifted by a note on the ticket (t notes) or --diagnosed "<cause 20+ chars>"; a ticket with no file is never refused. Tests: red-run.test.mjs 5 passed; units/submit-usage/withdraw/patch/health/metrics/stats/batch-window group 50 passed.

## History
- [2026-10-28 22:28] (created) feature — broker: red-run limit per ticket: after 2 consecutive red results (failed/compile) on one ticket, submit refuses the next job for that ticke
- [2026-10-29 00:46] (status) todo → review
