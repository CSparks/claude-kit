---
id: KIT-T722
title: Decision records attribute assistant-written content to the maintainer (2026-10-30, maintainer: 'you record decisions all the time that I di
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T04:16:33Z
updated: 2026-10-30T21:36:56Z
---

## Description
Decision records attribute assistant-written content to the maintainer (2026-10-30, maintainer: 'you record decisions all the time that I didn't make'). Example DE-D018: source 'Chris 2026-10-10' but the body adds 'Gearing is audio-only - it does not change the vehicle model', scope Chris never chose. Fix: the decision schema separates (1) the maintainer's verbatim words / picked option, (2) assistant-added scope or rationale, labelled as such; a gate rejects a decision whose source names the maintainer without a verbatim quote; one-time audit of existing D-items across stores flags bodies that exceed the quoted choice. Related KIT-T721, KIT-T429.

kit-bug-shape: cap:bug:decision-records-attribute-assistant-written-con
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed: decision-attribution.mjs (rule), t decide gate (maintainer-named source needs a **Maintainer:** verbatim quote; assistant scope goes in **Assistant-added:**), decision-audit.mjs (read-only audit; flags 62 legacy kit decisions, none rewritten). Evidence: scripts/t-decide.test.mjs 6 passed. Not done: audit across other stores (run node scripts/decision-audit.mjs <root> per repo); skill/snippet docs for the new labels.

## History
- [2026-10-30 04:16] (created) bug — Decision records attribute assistant-written content to the maintainer (2026-10-30, maintainer: 'you record decisions all the time that I di
- [2026-10-30 21:36] (status) todo → review
- [2026-10-30 21:36] (landed) f5d291b t decide refuses a maintainer-sourced decision without a verbatim quote; add decision audit; implements KIT-T722
