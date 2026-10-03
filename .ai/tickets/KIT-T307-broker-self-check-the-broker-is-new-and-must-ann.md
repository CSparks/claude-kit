---
id: KIT-T307
title: broker self-check: the broker is new and must announce its own faults instead of waiting to be noticed. On every poll, and from wait.mjs and
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T16:37:12Z
updated: 2026-10-03T16:51:39Z
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
- [x] no live daemon while jobs are queued is reported (health.json entry, stderr line)
- [x] a pause on dirt the broker's own last run wrote is reported and healed from the journal when safe
- [x] an inflight job older than 3x the longest recent command is reported
- [x] a gate crash or journal/restore mismatch is recorded as the broker's own fault
- [x] orient and flush print one line per health.json entry

## Plan
1.

## History
- [2026-10-03 16:37] (created) feature — broker self-check: the broker is new and must announce its own faults instead of waiting to be noticed. On every poll, and from wait.mjs and
- [2026-10-03 16:51] (comment) criterion added: no live daemon while jobs are queued is reported (health.json entry, stderr line)
- [2026-10-03 16:51] (comment) criterion added: a pause on dirt the broker's own last run wrote is reported and healed from the journal when safe
- [2026-10-03 16:51] (comment) criterion added: an inflight job older than 3x the longest recent command is reported
- [2026-10-03 16:51] (comment) criterion added: a gate crash or journal/restore mismatch is recorded as the broker's own fault
- [2026-10-03 16:51] (comment) criterion added: orient and flush print one line per health.json entry
- [2026-10-03 16:51] (comment) ticked: no live daemon while jobs are queued is reported (health.json entry, stderr line)
- [2026-10-03 16:51] (comment) ticked: an inflight job older than 3x the longest recent command is reported
- [2026-10-03 16:51] (comment) ticked: orient and flush print one line per health.json entry
- [2026-10-03 16:51] (comment) @sonnet55: Built: scripts/broker/health.mjs (+health-store, health-read), wired into broker.mjs poll, wait.mjs, submit.mjs, hooks/o (full comment #1 in ## Notes)
### comment #1 [2026-10-03 16:51] @sonnet55
Built: scripts/broker/health.mjs (+health-store, health-read), wired into broker.mjs poll, wait.mjs, submit.mjs, hooks/orient.mjs and flush.mjs; gate.mjs reports a crashing hook as gate-crash; patch.mjs records lastrun/faults and verifies the restore. Tests: scripts/broker/health.test.mjs (8, each detection plus negative controls), broker suite 74 passed, orient 24/flush 14 passed; mutation (drop the changed-since-run check) fails the negative control.
- [2026-10-03 16:51] (status) todo → review
- [2026-10-03 16:51] (comment) ticked: a pause on dirt the broker's own last run wrote is reported and healed from the journal when safe
- [2026-10-03 16:51] (comment) ticked: a gate crash or journal/restore mismatch is recorded as the broker's own fault
