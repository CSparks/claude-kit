---
id: KIT-T486
title: publish:runtime pruned the runtime a live broker daemon was running from (389bae9); every later gate crashed with Cannot find module pre-write.mjs
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T19:10:45Z
updated: 2026-10-14T19:14:29Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A broker or q-server pins the runtime copy it loaded (<sha>/.in-use/<pid>); publish:runtime never prunes a copy with a live pin; a dead pid's pin does not hold it (runtime-publish.test.mjs 9 passed; the mutation that ignores pins fails)

## Plan
1.

## History
- [2026-10-14 19:10] (created) bug — publish:runtime pruned the runtime a live broker daemon was running from (389bae9); every later gate crashed with Cannot find module pre-write.mjs
- [2026-10-14 19:14] (comment) criterion added: A broker or q-server pins the runtime copy it loaded (<sha>/.in-use/<pid>); publish:runtime never prunes a copy with a live pin; a dead pid's pin does not hold it (runtime-publish.test.mjs 9 passed; the mutation that ignores pins fails)
- [2026-10-14 19:14] (comment) ticked: A broker or q-server pins the runtime copy it loaded (<sha>/.in-use/<pid>); publish:runtime never prunes a copy with a live pin; a dead pid's pin does not hold it (runtime-publish.test.mjs 9 passed; the mutation that ignores pins fails)
- [2026-10-14 19:14] (status) todo → review
- [2026-10-14 20:34] (comment) @claude: REGRESSION on stiletto 2026-10-14 15:31 CDT: the 4f17789 publish pruned runtime c46775e while the stiletto broker daemon (full comment #1 in ## Notes)
### comment #1 [2026-10-14 20:34] @claude
REGRESSION on stiletto 2026-10-14 15:31 CDT: the 4f17789 publish pruned runtime c46775e while the stiletto broker daemon (pid 45236, started 14:25 from c46775e) was live; every gate call then failed with 'Cannot find module ...\c46775e\hooks\pre-write.mjs' (job j-mv8kfnt9-qil4bv, RG-T111, failed at gate; submit had warned 'HEALTH stalled: no beat for 233 s'). Cause: the daemon predates the pin mechanism, so it never wrote a pin and publish treated c46775e as unused. Wanted: publish also keeps any runtime named by a live broker.lock in the registered checkouts (claude-kit-projects.json) or by any process whose cwd/argv names the runtime dir, so a pre-pin daemon survives one more publish; and the daemon's gate resolves hooks through 'current' when its own dir is gone, failing the job with a 'restart me' message instead of a module error.
- [2026-10-14 20:40] (comment) @claude: Follow-up: publish also keeps any runtime a live broker lock in a registered checkout still runs from (the lock's runtim (full comment #2 in ## Notes)
### comment #2 [2026-10-14 20:40] @claude
Follow-up: publish also keeps any runtime a live broker lock in a registered checkout still runs from (the lock's runtime, or the copy current when an unpinned daemon started); locks now record their runtime. A daemon whose runtime vanished fails the job as 'runtime gone … restart me' (not a module error) and hands the lock to a fresh daemon started from current. runtime-publish 11 passed (dead-lock negative control; dropping the lock check fails it); gate.test runtime-gone case passed.
