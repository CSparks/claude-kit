---
id: KIT-T916
title: broker daemon restarted on a runtime supersede ignores the existing queue and idle-exits: dirt-empire 2026-11-09, daemon 18:14 (runtime cb3e
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T21:01:45Z
updated: 2026-11-10T00:07:16Z
---

## Description
broker daemon restarted on a runtime supersede ignores the existing queue and idle-exits: dirt-empire 2026-11-09, daemon 18:14 (runtime cb3ea43) logged 'runtime cb3ea43 superseded by published 4b02eb2; restarted' at 19:15:01; the new daemon (log daemon-2026-11-09T19-15-01-955Z-59880.log) watched the root lane with 7 job files in target/broker/queue (j-mw9qhcae, j-mw9qjmu6, j-mw9qk7ha, j-mw9qmgt5, j-mw9qni4j, j-mw9qoms4, j-mw9qpvj0) and ran none, then 'idle for 60 min, exiting' at 20:15; nothing ran until a new submit started a daemon at 20:50. 2.5 h of a signed bill lost. A restarted daemon must scan the queue at start; idle-exit must refuse while queue/ holds jobs.

kit-bug-shape: cap:bug:broker-daemon-restarted-on-a-runtime-supersede-i
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 21:01] (created) bug — broker daemon restarted on a runtime supersede ignores the existing queue and idle-exits: dirt-empire 2026-11-09, daemon 18:14 (runtime cb3e
- [2026-11-09 21:12] (landed) c38d8d8 broker: the idle-exit clock moves to idle-clock.mjs and is pinned by tests: a queued job (or measure job or pause) keeps
- [2026-11-09 21:19] (comment) @claude: Checked the dirt-empire data 2026-11-09: the 7 queued jobs have ids minted 20:48Z-20:56Z and submittedAt 20:50:39Z, i.e. (full comment #1 in ## Notes)
### comment #1 [2026-11-09 21:19] @claude
Checked the dirt-empire data 2026-11-09: the 7 queued jobs have ids minted 20:48Z-20:56Z and submittedAt 20:50:39Z, i.e. after the daemon idled out at 20:15Z, so the queue was empty during the 19:15Z-20:15Z window (finished.log has no job between 18:22Z and 21:00Z). A populated queue is not reproduced as the cause: broker.mjs already kept the idle clock running while queue/ holds a job and a restarted daemon drains first. Landed c38d8d8: the idle decision moved to scripts/broker/idle-clock.mjs and is pinned by idle-clock.test.mjs (queued job keeps the clock off, populated queue is run before idle exit). Still unexplained: what the orchestrator submitted between 19:15Z and 20:48Z, if anything.
- [2026-11-09 21:28] (comment) @claude: Ledger check: submissions.jsonl in dirt-empire holds only 2 submissions between 17:50Z and 20:48Z (j-mw9k77as 17:54Z, j- (full comment #2 in ## Notes)
### comment #2 [2026-11-09 21:28] @claude
Ledger check: submissions.jsonl in dirt-empire holds only 2 submissions between 17:50Z and 20:48Z (j-mw9k77as 17:54Z, j-mw9k982a 17:55Z); none between 17:56Z and 20:48Z, and reopened.jsonl has no resume row from 17:42Z to 20:48Z except 3 rows near 20:48Z. So the broker was handed no work during 19:15Z-20:15Z; the 2.5 h stall is not a daemon dropping a queue. c38d8d8 only pins existing behaviour; the described mechanism was not reproduced. Ticket stays todo.
- [2026-11-09 21:28] (comment) @claude: Correction to the ledger check: the three reopened.jsonl rows between 17:42Z and 20:48Z are all agent=main (17:42Z, 17:4 (full comment #3 in ## Notes)
### comment #3 [2026-11-09 21:28] @claude
Correction to the ledger check: the three reopened.jsonl rows between 17:42Z and 20:48Z are all agent=main (17:42Z, 17:48Z, 17:56Z); there is no worker resume from 17:56Z to 20:48Z, matching the empty submission ledger in that window.
- [2026-11-10 00:06] (comment) @claude: Withdrawn by the dirt-empire orchestrator 2026-11-09: not reproduced; the 7 queued jobs were minted at 20:48Z or later,  (full comment #4 in ## Notes)
### comment #4 [2026-11-10 00:06] @claude
Withdrawn by the dirt-empire orchestrator 2026-11-09: not reproduced; the 7 queued jobs were minted at 20:48Z or later, after the 20:15Z idle exit. The 2.5 h gap was the orchestrator session idling with results unread, not the broker.
- [2026-11-10 00:06] (status) todo → superseded
- [2026-11-10 00:07] (comment) @claude: dirt-empire-f0 withdrew it: 'your reading is right. The 7 jobs were minted at 20:48 or later; the gap was my session idl (full comment #5 in ## Notes)
### comment #5 [2026-11-10 00:07] @claude
dirt-empire-f0 withdrew it: 'your reading is right. The 7 jobs were minted at 20:48 or later; the gap was my session idling with results unread, not the broker. Close it as not-a-bug and keep c38d8d8's tests.' Closed as not-a-bug; c38d8d8 (idle-clock.mjs and its tests) stays.
- [2026-11-10 00:07] (status) superseded → done
