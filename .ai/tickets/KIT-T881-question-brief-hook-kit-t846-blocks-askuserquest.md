---
id: KIT-T881
title: question-brief hook (KIT-T846) blocks AskUserQuestion even when a 200-word brief (decision, evidence, options, recommendation, not-asked) wa
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T17:26:09Z
updated: 2026-11-07T18:15:52Z
---

## Description
question-brief hook (KIT-T846) blocks AskUserQuestion even when a 200-word brief (decision, evidence, options, recommendation, not-asked) was sent as prose in the prior reply of the same turn; it reports 'this reply prose has 0' three times. Result: the maintainer's sign-off questionnaire could not be posted and the session idled (see KIT-T880). Repro 2026-11-07 groovegrid session.

kit-bug-shape: cap:bug:question-brief-hook-kit-t846-blocks-askuserquest
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The real groovegrid brief blocked six times passes; a bare pick, an option-less reason, no recommendation and a stub decision still block (hooks/question-brief-sections.test.mjs)
- [x] Each missing section's block message states the exact phrase to write

## Plan
1.

## Notes
Root cause, replayed from the groovegrid transcript 39a9feec (2026-11-07) through turnText + briefProblems at each AskUserQuestion call: the brief reached the hook intact (322 words). The three calls with 0 words (lines 341/345/355) came before any brief existed and were correct blocks. The next three (395/434/450) failed on the recommendation alone: the brief wrote "**Recommendation.** Sign and continue in order, and leave the foreign edits alone. You dictated the bill, and the commit hooks guard each landing." The matcher needed because/since/which on the same line after "recommend"; a reason in the next sentence, or after a soft line wrap, never matched. The decision matcher had the same blind spot (a labelled line needed the word "Decision"; the 691-word scene-strip brief in d4f0476d said "Needs your sign-off" and was blocked on decision alone).
Fix: hooks/lib/brief-sections.mjs reads labelled sections (Label:, **Label:**, **Label.**, Label., Label - , ## Label) for both. A recommendation section passes when its first sentence names an option (by label words, or its "A:" key after a picking verb: "Take A") and the sentences after it give a reason of at least five words; the one-line "recommend ... because" form also passes across a line wrap. A section that falls short is told what it lacks. The five standard entries are now phrase templates, e.g. Recommendation: <option label>, because <reason>.
The ticket's quoted sentence ("I recommend signing ... because ...") passed the old matcher on one line and failed only when wrapped; both forms are fixtures.
Replay after the fix: lines 395/434/450 and 4811-4833 pass; 341/345/355 (0 prose) and 6397 (230 words, no recommendation) still block.
Related: KIT-T846, KIT-D129, KIT-T880, KIT-D136, KIT-T854, KIT-T856, KIT-T865, KIT-T867, KIT-T872, KIT-T876.
State: committed on main (470b6b8, 8a794b6), not pushed. NOT published: see KIT-T882 Notes (publish red on a broker test outside this change); current stays 32d78e3.
Tests run: question-brief-sections 14 passed, question-brief-gate 41 passed, agent-roster 47, lib 9, all green.
Handoff ab91838d09515cc0f:
- Jobs: KIT-T881 code done and committed.
- State: publish blocked on scripts/broker/build-contention-run.test.mjs (KIT-T879 writer's).
- Next: publish once that test is green on HEAD.
- Files: hooks/lib/question-brief.mjs, hooks/lib/brief-sections.mjs, hooks/question-brief-sections.test.mjs, hooks/question-brief-fixtures.mjs.

## History
- [2026-11-07 17:26] (created) bug — question-brief hook (KIT-T846) blocks AskUserQuestion even when a 200-word brief (decision, evidence, options, recommendation, not-asked) wa
- [2026-11-07 17:57] (landed) 470b6b8 checkout-holder: store (.ai/) writes never register a hold, entries record the session's origin repo and the block names
- [2026-11-07 18:07] (comment) criterion added: The real groovegrid brief blocked six times passes; a bare pick, an option-less reason, no recommendation and a stub decision still block (hooks/question-brief-sections.test.mjs)
- [2026-11-07 18:07] (comment) ticked: The real groovegrid brief blocked six times passes; a bare pick, an option-less reason, no recommendation and a stub decision still block (hooks/question-brief-sections.test.mjs)
- [2026-11-07 18:07] (comment) criterion added: Each missing section's block message states the exact phrase to write
- [2026-11-07 18:08] (comment) ticked: Each missing section's block message states the exact phrase to write
- [2026-11-07 18:14] (landed) 8a794b6 question-brief: a lettered option is picked only by its key after a picking verb; foreign-tree and holder messages name
- [2026-11-07 18:15] (edit) Notes replaced
- [2026-11-07 18:15] (status) todo → review
