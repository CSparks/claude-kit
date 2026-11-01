---
id: KIT-T734
title: broker-wait-gate false positive: a plain 'for a in ...; do node scripts/q.mjs code ... --path scripts/broker ...; done' loop (no sleep, no p
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T21:52:47Z
updated: 2026-10-30T22:10:22Z
---

## Description
broker-wait-gate false positive: a plain 'for a in ...; do node scripts/q.mjs code ... --path scripts/broker ...; done' loop (no sleep, no poll, no broker call; 'broker' only appears in a --path or a file name) is blocked as 'a sleep, poll or tail loop around the broker' (KIT-D115). Seen 2026-10-30 running q over scripts/broker.

kit-bug-shape: cap:bug:broker-wait-gate-false-positive-a-plain-for-a-in
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: the loop check no longer fires on a scripts/broker path or a script name in an argument; it needs a real broker call (now seen behind do/then keywords) or target/broker state. Evidence: hooks/broker-wait-gate.test.mjs 48 passed incl. the q-over-scripts/broker loop (passes) and a for loop calling broker.mjs (still blocked).
### comment #1 [2026-10-30 23:27] @kit-agent
seen again 2026-10-30 23:40: a one-shot 'for f in logs/*mvvhdz77*; do grep ... $f; done' and a 'node -e' with for(...) over target/broker result files were blocked by broker-wait-gate (reading target/broker in a loop is not a poll). Another writer is editing hooks/broker-wait-gate.mjs now, so left to them.
### comment #2 [2026-11-01 19:34] @claude
Recurred 2026-11-01 (dirt-empire-83 patch worker): broker-wait-gate blocked a one-shot shell for loop over two log greps reading finished target/broker/logs/*.log files, calling it a broker poll. Nothing waited on the broker.
Related: KIT-T785 finished the follow-up in comment 1 (read-only loops over broker state).

## History
- [2026-10-30 21:52] (created) bug — broker-wait-gate false positive: a plain 'for a in ...; do node scripts/q.mjs code ... --path scripts/broker ...; done' loop (no sleep, no p
- [2026-10-30 22:10] (landed) abbbc1a broker-wait-gate: a loop is a poll only when it calls the broker client or reads target/broker, not on a scripts/broker
- [2026-10-30 22:10] (status) todo → review
- [2026-10-30 23:27] (comment) @kit-agent: seen again 2026-10-30 23:40: a one-shot 'for f in logs/*mvvhdz77*; do grep ... $f; done' and a 'node -e' with for(...) o (full comment #1 in ## Notes)
- [2026-11-01 19:34] (comment) @claude: Recurred 2026-11-01 (dirt-empire-83 patch worker): broker-wait-gate blocked a one-shot shell for loop over two log greps (full comment #2 in ## Notes)
