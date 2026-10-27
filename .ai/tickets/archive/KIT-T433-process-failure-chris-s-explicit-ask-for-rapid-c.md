---
id: KIT-T433
title: Process failure: Chris's explicit ask for rapid, current model-capability research was never delivered, and the gate built to enforce it was
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T20:56:51Z
updated: 2026-10-27T22:27:25Z
---

## Description
Process failure: Chris's explicit ask for rapid, current model-capability research was never delivered, and the gate built to enforce it was satisfied by a price list. Chris 2026-10-12, verbatim: 'I certainly ask for more recent research later than two fucking months ago, in fact I asked just a couple of days ago.' / 'I was very explicit that the fucking landscape changes rapidly and it needs to be fucking updated rapidly.' ROOT CAUSE: KIT-T339's scheduled refresh researches only the lineup and prices (research/models-2026-10-10.md has no capability evidence), and running it clears the staleness gate; the gate checks the table's NEWEST evidence date, so orient showed 'table evidence 2026-10-10 (2 d)' while the opus rows (build 09-24, design 09-30, forensic 08-06) rested on a 2026-08-06 community sweep about Opus 5/Sonnet 5. Fix: (1) the refresh must research CAPABILITY per job for the current lineup (benchmarks + graded hands-on sources), not just prices; (2) staleness is judged PER ROW (oldest row evidence), and a row can only be re-dated by capability evidence; (3) orient shows the oldest row's age, not the newest; (4) refresh cadence stays weekly or faster. Capability research for the 5.5 generation done 2026-10-12 (to be saved as research/models-capability-2026-10-12.md).

kit-bug-shape: cap:bug:process-failure-chris-s-explicit-ask-for-rapid-c
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-12 20:56] (created) bug — Process failure: Chris's explicit ask for rapid, current model-capability research was never delivered, and the gate built to enforce it was
- [2026-10-12 20:57] (comment) @claude: Grounding: KIT-D088 (2026-10-10) already DECIDED this. Chris verbatim then: 'There needs to be a weekly reassessment bas (full comment #1 in ## Notes)
### comment #1 [2026-10-12 20:57] @claude
Grounding: KIT-D088 (2026-10-10) already DECIDED this. Chris verbatim then: 'There needs to be a weekly reassessment based on research about what each model can do. This shit matters because it determines how quickly we hit our weekly limit.' D088 says the refresh reassesses CAPABILITY per job (a per-job table in research/models-<date>.md) and re-dates only confirmed rows. The 2026-10-10 refresh wrote only lineup + prices, and nothing checks that the per-job capability table exists, so a decided requirement shipped unmet. Chris 2026-10-12: 'Fact I said a very specific frequency. Do you have any fucking recollection of that?' Fix: model-refresh.mjs refuses to finish (and the gate stays shut) unless research/models-<date>.md holds a per-job capability table with graded sources for every dispatch.jobs row; staleness is per row.
- [2026-10-12 21:13] (status) todo → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
