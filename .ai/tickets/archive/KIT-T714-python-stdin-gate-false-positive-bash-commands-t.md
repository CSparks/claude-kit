---
id: KIT-T714
title: python-stdin-gate false positive: Bash commands that never feed stdin to an interpreter are blocked as 'ambiguous quoting'. Seen 5 times in
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T20:26:24Z
updated: 2026-10-31T01:18:22Z
fixed_commit: 56f2169
---

## Description
python-stdin-gate false positive: Bash commands that never feed stdin to an interpreter are blocked as 'ambiguous quoting'. Seen 5 times in one comfy-volta session (2026-10-29): a grep -E pattern holding an escaped double quote before float8; a grep pattern with a caret-dollar empty-line regex; a non-empty heredoc into the interpreter (the gate's own message says that form is fine); a q.mjs call; and a cap.mjs call whose text merely contained the word python plus escaped quotes. Root cause: the quoting heuristic fires on any escaped quote anywhere in the command, not on an actual interpreter invocation reading stdin. Workaround used: Write/Edit tools and node scripts.

kit-bug-shape: cap:bug:python-stdin-gate-false-positive-bash-commands-t
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Already landed in 56f2169: ambiguous quoting is judged on quote-blind command pieces, not any python word. Verified 2026-10-31: hooks/python-stdin-gate.test.mjs 53 passed, including the escaped-quote grep -E 'float8' case and fed-python cases.

## History
- [2026-10-29 20:26] (created) bug — python-stdin-gate false positive: Bash commands that never feed stdin to an interpreter are blocked as 'ambiguous quoting'. Seen 5 times in
- [2026-10-29 20:29] (landed) 56f2169 fix(python-stdin-gate): judge ambiguous quoting on quote-blind command pieces, not any python word (implements KIT-T714)
- [2026-10-31 01:18] (status) todo → done
