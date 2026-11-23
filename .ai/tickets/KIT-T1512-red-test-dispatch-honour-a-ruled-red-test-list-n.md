---
id: KIT-T1512
title: red-test-dispatch: honour a ruled-red test list (named debt). A test written to fail on today's world (a measurement or acceptance test, dec
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-23T17:40:11Z
updated: 2026-11-23T17:52:09Z
---

## Description
red-test-dispatch: honour a ruled-red test list (named debt). A test written to fail on today's world (a measurement or acceptance test, decision-backed, fix unsigned) and a test the maintainer ruled stays red (RDG-D161) fire the gate on every closing reply that says 'red' or 'fails'. Needs a per-project list of named-debt tests (id, test name, deciding id, fix owner) that the gate reads and exempts, so only unexpected reds demand a fix agent.

kit-bug-shape: cap:feature:red-test-dispatch-honour-a-ruled-red-test-list-n:6ebf1f62
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built: named-debt list as one file per entry in .ai/red-by-design/<slug>.md (frontmatter test, decided_by, reason, owner, date), written only by 't red-by-design add|remove|list' (scripts/t/red-by-design.mjs; every entry cites a decision or ticket id the store holds; adding again renews the date). Gate red-test-dispatch (hooks/red-test-dispatch.mjs) drops a report whose sentence names a listed test (hooks/lib/red-by-design-match.mjs: file stem or name, case and _-. ignored; backticked names read), any other red in the same reply still blocks; an unreadable list exempts nothing. Orient prints an OPEN notice for entries older than 14 days (hooks/lib/orient/red-by-design.mjs). red-by-design joins NON_STORE_DIRS (scripts/id-utils.mjs) and the pre-write and shell store-write gates. Tests: hooks/red-test-dispatch.test.mjs 57 passed, hooks/red-by-design.test.mjs 22 passed, hooks/store-write-gate.test.mjs 44, hooks/store-shell-gate.test.mjs 66, scripts/t-verbs.test.mjs 13, scripts/id-utils.test.mjs 58. hooks/ruled-not-built.test.mjs fails at its orient case with or without this change (stale global-instructions notice), not touched.
Correction and changes after review: the orient case of hooks/ruled-not-built.test.mjs fails because the real machine's orient output is over the 9500-byte budget, so the RULED block is cut to its header and a pointer (read from a probe run); filed as KIT-T1513, not a cause tied to this ticket. Matcher tightened: a listed test is named by an identifier (file name, path, snake_case stem) or by its stem in words followed within three words by a test noun; a stem with no test noun after it names nothing. A capture is never exempt, only a closing-reply sentence. The stale block has its own orient-budget rule (keeps three rows and the command t red-by-design list) and says to raise each entry to the maintainer. Known limit: a sentence naming a listed test next to an unlisted red is exempt; name the unlisted red in its own sentence. Verb listed in docs/project-workflow.md. Tests after: hooks/red-test-dispatch.test.mjs 58 passed, hooks/red-by-design.test.mjs 25 passed, hooks/orient-overflow.test.mjs 10 passed.

## History
- [2026-11-23 17:40] (created) feature — red-test-dispatch: honour a ruled-red test list (named debt). A test written to fail on today's world (a measurement or acceptance test, dec
- [2026-11-23 17:52] (status) todo → review
