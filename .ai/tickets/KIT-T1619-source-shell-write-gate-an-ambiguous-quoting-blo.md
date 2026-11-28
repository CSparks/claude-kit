---
id: KIT-T1619
title: source-shell-write gate: an ambiguous-quoting block prints only the generic message, no reason, span or trigger word, because hooks/lib/shel
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T1620
superseded_by:
created: 2026-11-27T23:18:11Z
updated: 2026-11-27T23:18:11Z
---

## Description
source-shell-write gate: an ambiguous-quoting block prints only the generic message, no reason, span or trigger word, because hooks/lib/shell-source-write.mjs passes an ambiguous() builder that drops the ambiguity and trigger scanAllShellWrites hands it; the query gate and store gate print them. Without them a blocked agent cannot tell which construct (a backtick span inside double quotes, a backslash before a quote) or which write word fired, and captures misname the cause (KIT-T1618 blamed braces and an asterisk). Fix: keep reason, at, span and trigger on the hit and print them in source-shell-gate.mjs.

kit-bug-shape: cap:bug:source-shell-write-gate-an-ambiguous-quoting-blo:c5f31c41
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed on main as c39cd925 and pushed to origin main (0a26b11e..c39cd925). Targeted test hooks/source-shell-gate-ambiguity-message.test.mjs: 12 passed, 0 failed (red before the change: 7 failed). Runtime not published. Handoff: the publish is npm run publish:runtime at D:/dev/claude-kit; it runs the whole test suite at HEAD (about 45 min, KIT-T570), which needs his approval before it runs, and KIT-T1036 records main as red for that publish. Resume only after his approval: builds --run "npm run publish:runtime" --out target/publish-runtime.txt --timeout 170 --tool-timeout 180. Duplicate KIT-T1620 closed as superseded by KIT-T1619.
Correction to the handoff above: npm run publish:runtime runs no tests (scripts/runtime-publish.mjs header, KIT-D162); the whole-suite claim was wrong. The publish of c39cd925 was refused by the auto-mode permission classifier as a destructive action (it moves the live runtime current), so it is not published. Next: the maintainer grants that permission or runs npm run publish:runtime at D:/dev/claude-kit.

## History
- [2026-11-27 23:18] (created) bug — source-shell-write gate: an ambiguous-quoting block prints only the generic message, no reason, span or trigger word, because hooks/lib/shel
