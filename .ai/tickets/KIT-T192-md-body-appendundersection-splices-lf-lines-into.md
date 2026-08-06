---
id: KIT-T192
title: md-body.appendUnderSection splices LF lines into a CRLF store file, leaving mixed endings
type: bug
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:14Z
updated: 2026-08-06T02:29:14Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> (bug) md-body.appendUnderSection writes LF lines into a CRLF store file, leaving mixed endings. KIT-T110/T169 made frontmatter.mjs and criteria.mjs CRLF-tolerant AND ending-preserving (criteria.scan carries each line's \r and render puts it back), but md-body.appendUnderSection still splices in a plain \n line: after a t status/comment/tick on a CRLF ticket the History and Notes lines end LF while the rest of the file ends CRLF. Functional (verified: t status/comment/tick all round-trip, scripts/t.test.mjs CRLF cases pass) but it dirties the diff on Windows and a future ending-sensitive parser would trip on it. Fix: appendUnderSection should detect the body's dominant ending and emit it. Low priority - cosmetic, observed 2026-08-04 while landing KIT-T110/T169.

Provenance: `.ai/inbox/triaged/2026-08-04-1643-md-body-appendundersection-writes-lf-lines-into-.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] appendUnderSection preserves the file's dominant line ending, matching frontmatter.mjs and criteria.mjs (KIT-T110/T169)
- [ ] a t status/comment/tick on a CRLF ticket leaves no LF-only line behind (asserted on a CRLF fixture)

## Plan
1.

## History
- [2026-08-06 02:29] (created) bug — md-body.appendUnderSection splices LF lines into a CRLF store file, leaving mixed endings
- [2026-08-06 02:30] (comment) criterion added: appendUnderSection preserves the file's dominant line ending, matching frontmatter.mjs and criteria.mjs (KIT-T110/T169)
- [2026-08-06 02:30] (comment) criterion added: a t status/comment/tick on a CRLF ticket leaves no LF-only line behind (asserted on a CRLF fixture)
