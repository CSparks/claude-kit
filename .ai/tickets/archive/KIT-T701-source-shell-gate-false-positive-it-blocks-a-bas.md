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
