---
id: KIT-T701
title: source-shell-gate false positive: it blocks a Bash command whose write shape only appears inside a quoted string argument. On 2026-10-29, at
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T16:13:27Z
updated: 2026-10-29T16:17:11Z
fixed_commit: 36a6e60
---

## Description
source-shell-gate false positive: it blocks a Bash command whose write shape only appears inside a quoted string argument. On 2026-10-29, at runtime 82d7c67, a command running echo '<JSON whose command field holds: cd /d/dev/claude-kit && cat > hooks/zz-probe.mjs <<EOF>' | node hooks/source-shell-gate.mjs (feeding a synthetic payload to the gate) was blocked as a hand write to hooks/zz-probe.mjs, though nothing was written. The segment splitter treats && and > inside single quotes as shell operators. Fix: tokenize with quoting before matching redirects and cd; add a test with the shape inside '…' and "…" that must pass.

kit-bug-shape: cap:bug:source-shell-gate-false-positive-it-blocks-a-bas
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 16:13] (created) bug — source-shell-gate false positive: it blocks a Bash command whose write shape only appears inside a quoted string argument. On 2026-10-29, at
- [2026-10-29 16:17] (status) todo → done
- [2026-10-29 16:17] (landed) 36a6e60 shell write gates judge redirects and heredoc code on the command with quoted string content blanked (maskQuoted, one ho
- [2026-10-29 16:20] (landed) 70c797f tickets: KIT-T701 done (implements KIT-T701)
- [2026-10-29 16:31] (landed) 8e8d4d8 shell write gates fail closed on quoting: strings are blanked only as echo/printf arguments that feed no shell (shell-qu
- [2026-10-29 16:39] (comment) @sonnet55: Closed as WON'T FIX (maintainer decision): a write shape inside a quoted argument is rare, and every quote-masking versi (full comment #1 in ## Notes)
### comment #1 [2026-10-29 16:39] @sonnet55
Closed as WON'T FIX (maintainer decision): a write shape inside a quoted argument is rare, and every quote-masking version opened a bypass (a deny gate that blanks text is a parser differential). The gate scans the raw command. Workaround: put the payload in a scratchpad file (node hook.mjs < payload.json) or use the exclusion surfaces. Landed instead: wrapper recursion made linear with a depth cap of 4 that blocks, and tests that the bypass shapes (bash -c, powershell -Command, eval, command substitution, escaped quotes, echo | bash, echo | node -) block.
