---
id: KIT-T1618
title: source-shell-write gate blocks a t notes call (a store write through its own command) as an ambiguous-quoting hand write of a source file wh
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T23:12:20Z
updated: 2026-11-27T23:12:20Z
---

## Description
source-shell-write gate blocks a t notes call (a store write through its own command) as an ambiguous-quoting hand write of a source file when the note text holds braces and an asterisk

kit-bug-shape: cap:bug:source-shell-write-gate-blocks-a-t-notes-call-a-:ef982937
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Not fixed, held under RDG-D191 for KIT-T1585 (one lexer for every gate), as KIT-T1610 was. Path: hooks/source-shell-gate.mjs calls shellSourceWrites, whose scanAllShellWrites takes the ambiguous branch (hooks/lib/shell-write-scan.mjs ambiguousWrite) when the lexer cannot resolve the quoting. That branch splits the whole line on every operator whatever the quoting, exempts the pieces a kit verb leads, and blocks on a write word (copy, touch, install, rm, tee, a greater-than sign) in any other piece. So the note prose after a semicolon, pipe, ampersand or newline is judged as a command. Braces and an asterisk play no part: with plain quoting they never make a line ambiguous in either shell (reproduced). The real triggers: under bash, a backticked span inside a double-quoted note (the lexer rechecks the closing backtick as an opener and finds the outer closing quote: a quote inside a substitution inside double quotes); under PowerShell, a backslash before a quote (KIT-T1610). Reproduced with t notes, a double-quoted note holding a backticked span, then a semicolon and the word copy: blocked under bash, clear and passing once the whole note is single-quoted, in both shells. The backtick pairing fix was landed in fd39ec20 (KIT-T1546) and reverted in 31a2a0fa under RDG-D191, and the escaped-quote one in 6ca0de44. A wider store-verb exemption needs the end of the quoted argument proved, which is that same reverted relaxation: under PowerShell a backslash-quote really ends the string, so a write after it runs. Under bash a backtick inside double quotes is a real command substitution, so that text is not inert data either. Way out until KIT-T1585: single-quote the whole note text and use no backticks or escaped quotes inside double quotes. Side finding, not built: the ambiguous block prints no reason or trigger word, which is why the capture blamed braces and an asterisk. Prior work checked: KIT-T1610 notes, KIT-T1546 notes and its two commits, the untracked hooks/zz-repro.test.mjs (another writer) left in place.

## History
- [2026-11-27 23:12] (created) bug — source-shell-write gate blocks a t notes call (a store write through its own command) as an ambiguous-quoting hand write of a source file wh
