---
id: KIT-T1374
title: PROCESS FAILURE: coordinator kept citing RDG-D063 ('no test runs without sign-off') as a blanket rule through a long session, though RDG-D06
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T14:44:26Z
updated: 2026-11-18T15:01:31Z
---

## Description
PROCESS FAILURE: coordinator kept citing RDG-D063 ('no test runs without sign-off') as a blanket rule through a long session, though RDG-D065/D066 (2026-11-14) corrected it to 'targeted tests allowed, whole suite needs approval'. Root cause: D063 was never amended or marked superseded (D065 only says 'scope corrected' in prose), so D063 is the only one orient/summaries surface and it resurfaces after every compaction; the maintainer had to restate the rule on 2026-11-18 and a duplicate RDG-D122 was filed. Prevention wanted: a corrected decision carries a machine-visible 'corrected-by'/supersedes link that orient and q show print on the old one, and orient replays the corrected text instead; RDG-D122 retired as a duplicate of D065.

kit-bug-shape: cap:bug:process-failure-coordinator-kept-citing-rdg-d063:774d8dfd
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] t revise <newer> --supersedes <older> links a correction after the fact; q show prints SUPERSEDED BY on the older decision; orient drops it from standing and names the replacement under it in the recent list (scripts/decision-supersede.test.mjs)
- [x] a dispatch brief that cites a superseded decision gets a NOTE naming the replacement (hooks/dispatch-superseded.mjs)

## Plan
1.

## Notes
Root cause: a decision's correction had no machine-visible form after the fact. The kit's link for it is the newer decision's `supersedes:` (read by scripts/contract-rules/superseded-citations.mjs), but it could only be set at `t decide` time; RDG-D065 was recorded with "scope corrected" in prose and Relates only, so `q show`, orient and briefs kept presenting RDG-D063 as the rule. Neither `q show` nor orient read the supersede links at all.

Built:
- `t revise <newer> --supersedes <id,...>` adds the link after the fact (ids must be decisions of the store, never itself, each added once).
- `q show <old>` prints "SUPERSEDED BY <new> (<title>): this decision no longer stands as written; the rule is <new>" above the text.
- orient: a superseded decision is no longer listed as STANDING, and in the recent list it carries a "SUPERSEDED BY <new> — <title>" line under it. One map (retiredFrom) shared with the contract rule; orient builds it from its cached front-matter (cache key bumped).
- dispatch-guard: a brief citing a superseded decision gets a NOTE naming the replacement (warning only, check id dispatch-superseded; a "supersedes <id>" phrase stays quiet).

Store actions in road-generator, by command: `t revise RDG-D065 --supersedes RDG-D063,RDG-D122` (D122 retired as the duplicate restatement of D065; its 2026-11-18 maintainer quote is folded into D065 with `t revise RDG-D065 --file`). Wording note: the kit has one relation, "supersedes"; the banner reads SUPERSEDED BY rather than CORRECTED BY. RDG-D066 refines D065 and is not linked.

Tests: scripts/decision-supersede.test.mjs 4 pass (revise link, q show banner with negative controls, orient recent and standing, dispatch warning direct and through the guard); t-edit-verbs, contract-rules, ruled-not-built, dispatch-guard exit 0.

## History
- [2026-11-18 14:44] (created) bug — PROCESS FAILURE: coordinator kept citing RDG-D063 ('no test runs without sign-off') as a blanket rule through a long session, though RDG-D06
- [2026-11-18 15:01] (status) todo → doing
- [2026-11-18 15:01] (comment) criterion added: t revise <newer> --supersedes <older> links a correction after the fact; q show prints SUPERSEDED BY on the older decision; orient drops it from standing and names the replacement under it in the recent list (scripts/decision-supersede.test.mjs)
- [2026-11-18 15:02] (comment) criterion added: a dispatch brief that cites a superseded decision gets a NOTE naming the replacement (hooks/dispatch-superseded.mjs)
- [2026-11-18 15:02] (comment) ticked: t revise <newer> --supersedes <older> links a correction after the fact; q show prints SUPERSEDED BY on the older decision; orient drops it from standing and names the replacement under it in the recent list (scripts/decision-supersede.test.mjs)
- [2026-11-18 15:02] (comment) ticked: a dispatch brief that cites a superseded decision gets a NOTE naming the replacement (hooks/dispatch-superseded.mjs)
