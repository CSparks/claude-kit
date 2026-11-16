---
id: KIT-T1316
title: source-shell-write false positive (road-generator audit agent 2026-11-16): a read-only agent's Bash command 'node "$Q" code ... --path $S/gr
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T20:08:31Z
updated: 2026-11-16T20:36:26Z
---

## Description
source-shell-write false positive (road-generator audit agent 2026-11-16): a read-only agent's Bash command 'node "$Q" code ... --path $S/graphics_words.rs 2>&1 | head -2' inside a multi-line for/; chain with $S a shell variable was read as a hand write to $S/graphics_words.rs; an earlier q code with a quoted regex alternation 'a|b|c' was blocked as '(|pub/any.rs)'. The gate treats a pipe inside a quoted argument and a --path value as a redirect/write target. Fix: parse quoted args and q flags before judging, never treat a quoted | or a q --path value as a write.

kit-bug-shape: cap:bug:source-shell-write-false-positive-road-generator:274542ca
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a kit call after do/then/{/( or an env assignment, and node "$Q" in a loop, with a write word or --path value in its text, is no write

## Plan
1.

## Notes
Fix: kitLed (now hooks/lib/kit-led.mjs) skips do/then/else/{/(/! and env assignments before the verb (command-lead.mjs fromCommandWord) and counts node "$VAR" as a kit call; the gate cannot read a variable-held script either way, so the loosening costs nothing the scan could judge. Redirects outside quotes, tee, cp, install, sed -i still block. Tests: hooks/source-shell-gate-compound-kit.test.mjs 29 passed (12 fail at HEAD); shell-write-scan 54, source-shell-gate 168, git-gaps 133, builds-run 24 ok, move-lines 63, store-shell-gate 66, node-args 76, wrapped 53, chained 13 passed.

## History
- [2026-11-16 20:08] (created) bug — source-shell-write false positive (road-generator audit agent 2026-11-16): a read-only agent's Bash command 'node "$Q" code ... --path $S/gr
- [2026-11-16 20:36] (comment) criterion added: a kit call after do/then/{/( or an env assignment, and node "$Q" in a loop, with a write word or --path value in its text, is no write
- [2026-11-16 20:36] (comment) ticked: a kit call after do/then/{/( or an env assignment, and node "$Q" in a loop, with a write word or --path value in its text, is no write
- [2026-11-16 20:36] (status) todo → review
