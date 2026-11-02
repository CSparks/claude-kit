---
id: KIT-T822
title: Broker hand-back has no resume half (DE-D062/KIT-D115): a finished job's result sits unread, a lost job/crashed worker is not recovered; nee
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T15:41:32Z
updated: 2026-11-02T15:55:55Z
---

## Description
Broker hand-back has no resume half (DE-D062/KIT-D115): a finished job's result sits unread, a lost job/crashed worker is not recovered; needs a reconciler at orient + each turn

kit-bug-shape: cap:bug:broker-hand-back-has-no-resume-half-de-d062-kit-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built 60fd3ca: submissions ledger + kept job copies (scripts/broker/submissions.mjs), finished.ack, resubmit.mjs/ack.mjs, reconciler hooks/lib/handback.mjs (result-ready, job-lost, successor, dead agent), UserPromptSubmit handback-directive, orient section, Stop gate names the failing step, resume-check acks on SendMessage. Evidence: hooks/handback.test.mjs 30 passed (end modes: hand-back, killed, usage limit, purged result, crash mid-submit, lost job, unrecoverable surfaces once), scripts/broker/submissions.test.mjs 3 passed, successor-gate 16, orient 34, plugin-compat 141, full publish suite 212 files green.

## History
- [2026-11-02 15:41] (created) bug — Broker hand-back has no resume half (DE-D062/KIT-D115): a finished job's result sits unread, a lost job/crashed worker is not recovered; nee
- [2026-11-02 15:41] (landed) 60fd3ca Broker hand-back resume: submissions ledger + kept job copies, reconciler (result-ready, job-lost, successor, dead agent
- [2026-11-02 15:55] (status) todo → review
- [2026-11-02 15:56] (landed) 1002fe7 Ticket store: KIT-T821/T822 to review with evidence, decisions KIT-D129/D130, roadmap and index regenerated, T698/T816/T
- [2026-11-02 16:14] (landed) 733947c plugin 0.1.30: sessions load the new handback-directive UserPromptSubmit hook; KIT-T821/T822 notes (implements KIT-T822)
- [2026-11-02 16:17] (landed) 1044337 codex plugin 0.1.30 to match the Claude manifest (implements KIT-T822) [no-test: version bump, plugin-compat run]
