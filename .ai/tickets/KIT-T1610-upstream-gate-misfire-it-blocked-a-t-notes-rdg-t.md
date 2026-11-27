---
id: KIT-T1610
title: upstream-gate misfire: it blocked a 't notes RDG-T148 <prose>' call (a ticket note, no gh or git submission) as an ambiguous git submission
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T17:18:28Z
updated: 2026-11-27T17:18:28Z
---

## Description
upstream-gate misfire: it blocked a 't notes RDG-T148 <prose>' call (a ticket note, no gh or git submission) as an ambiguous git submission because the prose argument mentioned git config and a pipe into pre-push.mjs and held escaped double quotes. The gate should judge only the command words, not text inside a quoted argument of t, cap or q.

kit-bug-shape: cap:bug:upstream-gate-misfire-it-blocked-a-t-notes-rdg-t:342ff676
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Not fixed, stopped under RDG-D191. This is the same false block as KIT-T1564, whose fix (read the call with the tools own shell so an escaped quote inside a t or cap argument resolves) drew several security rounds and was reverted in 6ca0de44; RDG-D191 point 4 says these false blocks come back and are lived with until KIT-T1585, one lexer for every gate, lands whole. Proving that a call is one store verb and nothing else needs the escaped quotes resolved, which is that reverted relaxation; and a double-quoted argument is not inert data, since a substitution inside it runs. So the fix belongs to KIT-T1585. Way out until then: write the note text with no backslash-escaped quotes (single-quote the whole prose). Prior work checked: the untracked hooks/zz-repro.test.mjs (another writer, 16 days old) runs hand-write-detect and pre-write on a meshkit-check command; it reproduces neither this ticket nor KIT-T1609 and was left in place.

## History
- [2026-11-27 17:18] (created) bug — upstream-gate misfire: it blocked a 't notes RDG-T148 <prose>' call (a ticket note, no gh or git submission) as an ambiguous git submission
