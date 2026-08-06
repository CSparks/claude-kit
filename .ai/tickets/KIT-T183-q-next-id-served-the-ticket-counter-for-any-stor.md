---
id: KIT-T183
title: q next-id served the TICKET counter for any store name it did not recognize — a silent id-collision generator
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes: KIT-T109
superseded_by:
created: 2026-08-06T02:02:05Z
updated: 2026-08-06T02:06:09Z
---

## Description
`q next-id <scope> <store>` resolved its store argument through a lenient mapper that
defaulted ANYTHING it did not recognize to `tickets`. Four measured failures on 2026-08-05/06,
all of them id-collision generators rather than query errors:

    q next-id ST decision   -> ST-decision128   (the TICKET counter, bogus letter)
    q next-id ST            -> ST-undefined128   (KIT-T109, same site)
    q next-id               -> "Provided value cannot be bound to SQLite parameter 1"
    q --no-db next-id ST decisions (from another project's cwd) -> ST-D001

The last one is the "next-id returns 1 for decisions" report: the markdown-scan fallback opens
ONE root, so any scope other than the cwd project's counts from zero — it would have handed out
ST-D001 over a store that already held thirteen decisions. ST-D012/ST-D013 had to be
hand-counted with `q sql` because of this class.

Root cause: `q-model.storeForType` guessed instead of refusing, and `formatId` derived the id
letter from the RAW argument (`STORE_TYPE[type] || type`), so an unrecognized word became the
id segment verbatim. Supersedes KIT-T109 — the `undefined` segment is the same defect with an
empty argument.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] next-id resolves a store by plural name, singular, or id letter for every store (T/D/N/Q/R/E) — case-insensitive
- [x] an unknown or absent store is REFUSED with a message naming the real stores; no id is printed
- [x] an absent scope is refused with a usage message, not a raw SQLite binding error
- [x] the id letter always comes from the resolved store (no ST-decision128 / ST-undefined128 segments)
- [x] the markdown-scan path refuses a scope it cannot see instead of minting <SCOPE>-D001
- [x] cache and scan return identical next-id rows for every store
- [x] scripts/q.test.mjs covers all of the above, including the two literal repro commands

## Plan
1. Replace the lenient mapper with strict `resolveStore`/`requireStore` (aliases derived from
   STORE_TYPE: plural, singular, id letter) plus `requireScope`; refuse anything else.
2. `formatId` delegates to `id-utils.formatItemId`, so the letter mapping has ONE home.
3. Guard the scan path: refuse a scope the scanned root cannot see, naming `--root` as the fix.
4. Regression tests in scripts/q.test.mjs over every store letter, both paths, and the CLI.

## History
- [2026-08-06 02:02] (created) bug — q next-id served the TICKET counter for any store name it did not recognize — a silent id-collision generator
- [2026-08-06 02:05] (comment) criterion added: next-id resolves a store by plural name, singular, or id letter for every store (T/D/N/Q/R/E) — case-insensitive
- [2026-08-06 02:05] (comment) criterion added: an unknown or absent store is REFUSED with a message naming the real stores; no id is printed
- [2026-08-06 02:05] (comment) criterion added: an absent scope is refused with a usage message, not a raw SQLite binding error
- [2026-08-06 02:05] (comment) criterion added: the id letter always comes from the resolved store (no ST-decision128 / ST-undefined128 segments)
- [2026-08-06 02:05] (comment) criterion added: the markdown-scan path refuses a scope it cannot see instead of minting <SCOPE>-D001
- [2026-08-06 02:05] (comment) criterion added: cache and scan return identical next-id rows for every store
- [2026-08-06 02:05] (comment) criterion added: scripts/q.test.mjs covers all of the above, including the two literal repro commands
- [2026-08-06 02:05] (comment) ticked: next-id resolves a store by plural name, singular, or id letter for every store (T/D/N/Q/R/E) — case-insensitive
- [2026-08-06 02:05] (comment) ticked: an unknown or absent store is REFUSED with a message naming the real stores; no id is printed
- [2026-08-06 02:05] (comment) ticked: an absent scope is refused with a usage message, not a raw SQLite binding error
- [2026-08-06 02:05] (comment) ticked: the id letter always comes from the resolved store (no ST-decision128 / ST-undefined128 segments)
- [2026-08-06 02:05] (comment) ticked: the markdown-scan path refuses a scope it cannot see instead of minting <SCOPE>-D001
- [2026-08-06 02:05] (comment) ticked: cache and scan return identical next-id rows for every store
- [2026-08-06 02:05] (comment) ticked: scripts/q.test.mjs covers all of the above, including the two literal repro commands
- [2026-08-06 02:06] (status) todo → review
- [2026-08-06 02:06] (comment) fixed: strict store/scope resolution in q-model (resolveStore/requireStore/requireScope), formatId delegates to id-utils.formatItemId, scan path refuses an unseeable scope. Evidence: scripts/q.test.mjs 56 passed, 0 failed (23 new); db-parity 21 passed; db-cache 66 passed; id-utils 41 passed.
