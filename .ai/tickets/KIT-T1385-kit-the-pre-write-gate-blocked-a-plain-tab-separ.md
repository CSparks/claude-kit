---
id: KIT-T1385
title: Kit: the pre-write gate blocked a plain tab-separated scratchpad file of test names (a triage table) with the magic-numbers check; a non-cod
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T18:53:57Z
updated: 2026-11-18T19:07:05Z
fixed_commit: d36bca38
---

## Description
Kit: the pre-write gate blocked a plain tab-separated scratchpad file of test names (a triage table) with the magic-numbers check; a non-code data file in the scratchpad should not be linted for magic numbers (reported by triage agent adbcaf883ce823e21, session 4100d9bf)

kit-bug-shape: cap:bug:kit-the-pre-write-gate-blocked-a-plain-tab-separ:f6b1bf9e
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a tsv, tab, psv, log or out data file is never linted as code, and a file in the session scratchpad (under the temp directory, in no git repo) skips the magic-number lint; shipped code and repos under temp are still linted (hooks/pre-write-scratch.test.mjs)

## Plan
1.

## Notes
Root cause: hooks/pre-write.mjs exits early only for the extensions in its DATA, DOC, MARKUP, PATCH and style sets; `tsv` (and `log`, `out`, `tab`, `psv`) were in none, so a tab-separated triage table fell through to the code checks and its numbers read as magic constants. Nothing exempted the session scratchpad either.

Fix: tsv, tab, psv, log and out join DATA (never linted as logic). A file under the temp directory that sits in no git repo (the session scratchpad; hooks/lib/source-path.mjs isTempPath, which isSourcePath now shares) skips the magic-number lint. A repo that happens to live under the temp directory (every test fixture) is still linted; the first cut exempted all temp paths and pre-write-comment-state's controls caught it.

Second question (cheap check): a sanctioned filter for a run's own output file exists: `q code "<regex>" --regex --dir <output file>` scans one unindexed file on demand (checked on a test-result file), and the Read tool opens it by offset. Both are in the one-file-search block text and in every agent's Search section and wait rule; agents of a session started before those texts landed do not carry them (restart). No ticket filed.

Tests: hooks/pre-write-scratch.test.mjs all pass (tsv, log and a scratch script with a magic number in the scratchpad pass; a magic number in shipped code under the home directory still blocks; a tsv in a repo passes); pre-write all pass (75 assertions); pre-write-comment-state 7; source-shell-gate 168.

## History
- [2026-11-18 18:53] (created) bug — Kit: the pre-write gate blocked a plain tab-separated scratchpad file of test names (a triage table) with the magic-numbers check; a non-cod
- [2026-11-18 19:06] (status) todo → doing
- [2026-11-18 19:06] (comment) criterion added: a tsv, tab, psv, log or out data file is never linted as code, and a file in the session scratchpad (under the temp directory, in no git repo) skips the magic-number lint; shipped code and repos under temp are still linted (hooks/pre-write-scratch.test.mjs)
- [2026-11-18 19:06] (comment) ticked: a tsv, tab, psv, log or out data file is never linted as code, and a file in the session scratchpad (under the temp directory, in no git repo) skips the magic-number lint; shipped code and repos under temp are still linted (hooks/pre-write-scratch.test.mjs)
- [2026-11-18 19:06] (landed) d36bca38 pre-write: tab-separated, log and out data files are not linted as code, and a scratchpad file (temp directory, no repo)
- [2026-11-18 19:07] (status) doing → review
- [2026-11-18 19:07] (comment) runtime d36bca38 published
