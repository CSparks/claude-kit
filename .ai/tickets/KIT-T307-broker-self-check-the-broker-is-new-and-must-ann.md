---
id: KIT-T307
title: broker self-check: the broker is new and must announce its own faults instead of waiting to be noticed. On every poll, and from wait.mjs and
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T16:37:12Z
updated: 2026-10-03T16:37:12Z
---

## Description
Broker self-check: the broker is new and must announce its own faults instead of waiting to be noticed. On every poll, and from wait.mjs and submit.mjs, detect and report loudly, as a stderr line plus a status file the session hooks surface:
1. No live daemon while jobs are queued.
2. The queue is paused on dirt that the broker's own last run wrote: a lockfile or path changed within seconds of a job or re-check ending, or a path in that job's journal.
3. An inflight job older than three times its commands' longest recent duration.
4. A job failed for a reason the broker classifies as its own: a gate crash, or a journal/restore mismatch.

Where safe, self-heal case 2 by restoring from the journal. Every detection names a likely cause and the kit ticket to file.

Decisions (coordinator, 2026-10-03): the status file is target/broker/health.json, an array of { kind, since, detail, cause }, empty when healthy. The kit's session hooks (orient at SessionStart, flush at Stop) print a one-line warning per entry when it is non-empty.

kit-bug-shape: cap:feature:broker-self-check-the-broker-is-new-and-must-ann
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-03 16:37] (created) feature — broker self-check: the broker is new and must announce its own faults instead of waiting to be noticed. On every poll, and from wait.mjs and
