---
id: KIT-T1027
title: security review of the pushed shell-write-scan lane found 3 medium issues: (1) hooks/lib/node-args.mjs PLAIN_OPTION lets node --test-reporte
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T06:29:28Z
updated: 2026-11-11T06:29:28Z
---

## Description
security review of the pushed shell-write-scan lane found 3 medium issues: (1) hooks/lib/node-args.mjs PLAIN_OPTION lets node --test-reporter, --test-reporter-destination, --experimental-* and config-file options count as inert, and a bare node x.test.mjs is inert even if the file is untracked or changed; use a small allowlist of harmless options. (2) hooks/lib/inert-command.mjs GENERATORS allows adb and pytest/jest/vitest/mocha without the containment check isTestRun applies to node; drop adb or require no source-path destination. (3) hooks/lib/inert-command.mjs splitSubstitutions only handles $( so <( and >( process substitution hides commands; fail closed when <( or >( appears. Lane owner: session da28715f (files overlap its uncommitted work, so the fix waits for or goes through that lane). --label kit-bug

kit-bug-shape: cap:bug:security-review-of-the-pushed-shell-write-scan-l
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 06:29] (created) bug — security review of the pushed shell-write-scan lane found 3 medium issues: (1) hooks/lib/node-args.mjs PLAIN_OPTION lets node --test-reporte
