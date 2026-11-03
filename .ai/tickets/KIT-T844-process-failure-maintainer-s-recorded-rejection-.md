---
id: KIT-T844
title: process failure: maintainer's recorded rejection of a decision/plan (ticket comment DE-T227, 2026-10-29, 'I DIDN'T FUCKING SAY THE MX TRACKS
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T01:26:28Z
updated: 2026-11-03T16:31:47Z
---

## Description
process failure: maintainer's recorded rejection of a decision/plan (ticket comment DE-T227, 2026-10-29, 'I DIDN'T FUCKING SAY THE MX TRACKS NEEDED A DIFFERENT LAYOUT') was lost; DE-T229 plan then added a non-stadium barrier kind via a coordinator ruling never taken to him, DE-D063 stayed standing. Root cause: a ticket comment carrying the maintainer's anger/rejection is not linked to or surfaced on the decision it rejects, and orient/dispatch grounding reads decisions, not comments; a 'technical ruling, not taken to Chris' can override his stated intent unchecked. Wanted: when grounding a decision or dispatching on it, surface later maintainer comments mentioning its topic/id; flag coordinator rulings that diverge from a maintainer quote.

kit-bug-shape: cap:bug:process-failure-maintainer-s-recorded-rejection-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the dispatch brief (begin-task --md, governing-brief) prints, under each governing decision, the maintainer's later comments on its subject (decision id named, or 3+ title words shared) with an OBJECTION? flag; maintainer-said 5 passed

## Plan
1.

## Notes
Root cause: dispatch grounding read decisions only; the maintainer's comment on DE-T227 shared topic words with DE-D063 but no link or id, so nothing carried it to the brief. maintainer-said.mjs ranks maintainer-authored comments dated on/after the decision by shared title words (>=3) or id mention; governing-brief prints the top 3 under the decision. Checked against dirt-empire: DE-D063 now shows DE-T227#1 first. NOT built (needs a ruling): a mechanical check that a coordinator ruling diverges from a maintainer quote; surfacing in orient/q show for a decision.

## History
- [2026-11-03 01:26] (created) bug — process failure: maintainer's recorded rejection of a decision/plan (ticket comment DE-T227, 2026-10-29, 'I DIDN'T FUCKING SAY THE MX TRACKS
- [2026-11-03 16:23] (status) todo → doing
- [2026-11-03 16:31] (comment) criterion added: the dispatch brief (begin-task --md, governing-brief) prints, under each governing decision, the maintainer's later comments on its subject (decision id named, or 3+ title words shared) with an OBJECTION? flag; maintainer-said 5 passed
- [2026-11-03 16:31] (comment) ticked: the dispatch brief (begin-task --md, governing-brief) prints, under each governing decision, the maintainer's later comments on its subject (decision id named, or 3+ title words shared) with an OBJECTION? flag; maintainer-said 5 passed
- [2026-11-03 16:31] (status) doing → review
