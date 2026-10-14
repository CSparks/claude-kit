---
id: KIT-T498
title: broker idle time: jobs sat queued with no daemon alive (dirt-empire 1847 of 2475 waiting min; a crashed daemon nobody restarted held 5 jobs 6 h on 2026-10-14). wait never started a daemon, a thrown error ended the daemon, orient only noted health
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T22:46:23Z
updated: 2026-10-14T22:46:26Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T301, KIT-T482, KIT-T495
### comment #1 [2026-10-14 22:46] @claude
Fixed: wait.mjs starts a daemon (launch.mjs: detached, logged, spawnedBy) when its job is queued and none is alive past the grace; a broker error inside a job fails that job (contain.mjs: journal restored or landing resumed, fault 'daemon-error') and the daemon carries on; orient prints '--- DISPATCH NOW: N broker job(s) queued, no daemon running (oldest waiting M min)' with the start command (silent when paused or empty). The idle exit only counts empty-queue minutes. idle.test.mjs 4 passed (wait starts one and the job lands, daemon log written; negative control BROKER_NO_AUTOSTART times out with the job still queued; orient block + paused/empty silent; a throwing job fails alone and the next lands; mutation rethrowing in queue.mjs fails it). npm test exit 0, broker 197 passed.

## History
- [2026-10-14 22:46] (created) bug — broker idle time: jobs sat queued with no daemon alive (dirt-empire 1847 of 2475 waiting min; a crashed daemon nobody restarted held 5 jobs 6 h on 2026-10-14). wait never started a daemon, a thrown error ended the daemon, orient only noted health
- [2026-10-14 22:46] (comment) @claude: Fixed: wait.mjs starts a daemon (launch.mjs: detached, logged, spawnedBy) when its job is queued and none is alive past  (full comment #1 in ## Notes)
- [2026-10-14 22:46] (status) todo → review
