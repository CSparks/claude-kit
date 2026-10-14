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
