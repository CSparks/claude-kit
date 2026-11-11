---
id: KIT-T832
title: q gap: a grep followed an empty q sym for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T18:14:30Z
updated: 2026-11-02T18:53:45Z
fixed_commit: 5109170
---

## Description
q: q sym foot --path rapid-game/rust/core/rg-ik --type fn,struct  then  grep: pub fn\|pub struct\|^//!

kit-bug-shape: q-gap:grep-after-empty-q:sym
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x]

## Plan
1.

## Notes
Diagnosis: q sym foot --path rapid-game/rust/core/rg-ik --type fn,struct was correctly empty (rg-ik holds only 'mod foot'; q sym with other names lists the same crate fine). The detector hooks/lib/q-miss.mjs counted the flag names and values of the q command (path, type, struct...) as search terms, so the later listing grep 'pub fn|pub struct|^//!' shared 'struct' via --type and filed a false q-gap. Fix: queryTerms strips value flags, bare flags and redirects before term matching. Test: hooks/q-miss.test.mjs 12 passed, search-telemetry 22 passed.

## History
- [2026-11-02 18:14] (created) bug — q gap: a grep followed an empty q sym for the same terms
- [2026-11-02 18:53] (comment) ticked:
- [2026-11-02 18:53] (landed) 5109170 q-miss counts only search terms, not q flag names or values; a lapsed done regression needs no fixed_commit; q-miss 12,
- [2026-11-02 18:53] (status) todo → review
- [2026-11-02 18:56] (landed) 7f92e03 KIT-T832, KIT-T835 to review [no-test: ticket store only] (implements KIT-T832)
