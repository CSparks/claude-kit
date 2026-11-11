---
id: KIT-T979
title: source-shell-gate misfire: a read-only Bash loop (for f in suite logs; grep -m1 -oE pattern with an escaped quote in a bracket class; date -
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T22:46:07Z
updated: 2026-11-10T22:46:07Z
---

## Description
source-shell-gate misfire: a read-only Bash loop (for f in suite logs; grep -m1 -oE pattern with an escaped quote in a bracket class; date -r; echo) was blocked as 'a shell command may write a source file by hand' purely for 'ambiguous shell quoting'. Nothing in the command writes a file (no redirect, no sed -i, no tee). The gate should judge writes by write operators and target paths, not quote style.

kit-bug-shape: cap:bug:source-shell-gate-misfire-a-read-only-bash-loop-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Agent diagnosis, NOT fixed: the shell-write-scan lane of session da28715f is active (hooks/shell-copy-target.test.mjs is dirty; KIT-T954/T941/T933/T949/T951), so no scan code was touched.

Probe with shellSourceWrite (hooks/lib/shell-source-write.mjs): a read-only loop of the shape  for f in a.log b.log; do grep -m1 -oE "[^\"]+ok" "$f"; date -r "$f"; echo; done  returns null (allowed), but the same loop with a > inside the bracket class ([^\">]+ok) returns {ambiguous:true} (blocked). This very note was blocked by the same gate when its command carried escaped quotes.

Cause: the escaped quote matches AMBIGUOUS_QUOTING (hooks/lib/shell-segments.mjs:20), so scanShellWrites takes the ambiguousWrite path (hooks/lib/shell-write-scan.mjs). That path flags any WRITE_TOKEN (a write-tool word or a >) or FS_WRITE call anywhere in the non-kit pieces, so a > or a word such as cp/install/sed inside a grep pattern counts as a write.

Ready design: in ambiguousWrite treat a piece led by a READER command (grep, cat, head, tail, ls, wc, diff ...) like a kit-led piece, after stripping leading shell keywords (do, then, else, {, !, time): only its redirect targets are judged by hit(target), so a redirect into a source file still blocks, and its words never count as write tokens. Pieces are already cut on every operator, so a write behind ; | && is its own piece and still tested.

Tests to add (hooks/shell-write-scan.test.mjs, hooks/source-shell-gate.test.mjs): the loop above with > in the pattern passes; grep with an escaped quote redirected into src/a.cpp still blocks; grep then sed -i on src/a.cpp in one ambiguous command still blocks; control: a bare cp into src/a.cpp in an ambiguous command blocks.

## History
- [2026-11-10 22:46] (created) bug — source-shell-gate misfire: a read-only Bash loop (for f in suite logs; grep -m1 -oE pattern with an escaped quote in a bracket class; date -
- [2026-11-11 02:52] (landed) 5149552 tickets: KIT-T979 diagnosis and ready fix design recorded; code held for the shell-write-scan lane (implements KIT-T979)
