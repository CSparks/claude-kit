---
id: KIT-T906
title: question-brief-gate missed the Recommendation and Not asked lines of a brief that held them (session 9d88860c, 2026-11-08 ~20:10): the brief
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T20:12:35Z
updated: 2026-11-10T18:09:20Z
---

## Description
question-brief-gate missed the Recommendation and Not asked lines of a brief that held them (session 9d88860c, 2026-11-08 ~20:10): the brief text carried 'Recommendation: (Recommended) Keep loud, fix line, because ...' and 'Not asked: ...' as its last two paragraphs, yet the block listed both as missing while finding Decision/Evidence/options in the same message. Suspects: the '(Recommended)' label prefix breaks the recommendation match, or the gate reads a truncated block. q gates question shows the shapes it expects.

kit-bug-shape: cap:bug:question-brief-gate-missed-the-recommendation-an
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
### Handoff a250066eb4f1d5972
- Jobs: none open. Publish runs: db2f606, ecad15b, cb3ea43, 4b02eb2 (current runtime 4b02eb2, suite passed). Last publish follow-up pid 48708 (log publish-followup.log in the runtime dir) ran 137 test files that did not fit the budget; read publish-followup.json before the next publish.
- State: narration counting (KIT-T893) stays; KIT-T906 added text-only replyHasText, a "Blocks read" listing, a narration note, and acceptance of a brief written in the questionnaire's own question text (703df8b, notes db2f606). Landed from the same hand-off: KIT-T908 publish.lock names its holder (ecad15b), KIT-T909 and KIT-T912 handback notices (bc81ba6), KIT-T913 named tests decide the broker verdict (13016f7), KIT-T914 precheck logs under logs/ and a 14-day sweep (6e57a5a), KIT-T911 untagged primary target verified plus unverified-dir alert (cb3ea43) and the sweep hold list with D:/dev/dirt-empire/target held (4b02eb2; hold file C:/Users/Chris Sparks/.claude/build-sweep-holds.txt).
- Next: (1) the KIT-D153 pass, gate files now committed (HEAD 4b02eb2): question-brief-gate checks only that a plain summary of reasonable length came first in the turn (narration or text, or the question text carries it); drop the exact-label and sentence-shape checks in hooks/lib/question-brief.mjs, hooks/lib/question-text.mjs, hooks/question-brief-gate.mjs; reconcile with the committed KIT-D152 audit files hooks/question-brief-audit.mjs, hooks/lib/question-audit.mjs, hooks/lib/question-audits.mjs, hooks/lib/orient/brief-misses.mjs; keep question-gate, ids-described, reask and question-ready. (2) Shrink `q gates question` (hooks/lib/gate-protocol.mjs) to summary then questionnaire. (3) Shrink the KIT-D129/D142/D146 questionnaire section of user-config/CLAUDE.global.md to one rule citing KIT-D153. (4) Update tests (exact-shape cases go; add plain summary passes, no summary fails, narration summary passes), publish, commit and push. (5) Unrelated untracked kit items seen in git status, not mine, left to their owners: .ai/tickets KIT-T831, T849, T857-T859, T862-T864, T866, T868-T871, T875-T878, T880, T883-T890, T892, T895, T900, T902, T903, T905; .ai/decisions KIT-D131, D133-D139, D142, D144, D145, D147-D151; .ai/reopened.jsonl; the archived tickets under .ai/tickets/archive; the other session's tracked .ai edits and deletions.
- Files: hooks/lib/turn-text.mjs, hooks/lib/assistant-text.mjs, hooks/lib/question-brief.mjs, hooks/lib/question-text.mjs, hooks/question-brief-gate.mjs, hooks/lib/gate-protocol.mjs, hooks/question-brief-labels.test.mjs, user-config/CLAUDE.global.md (not edited).
Closed against 424fd59 and e55f6a7 (KIT-D153): exact-label and sentence-shape checks are gone, so a brief with Recommendation/Not asked lines in any shape cannot be reported missing; the audit judges only a summary of reasonable length. Re-run by the standing kit agent: question-brief-audit, -narration, -turn, -gate tests pass.

## History
- [2026-11-08 20:12] (created) bug — question-brief-gate missed the Recommendation and Not asked lines of a brief that held them (session 9d88860c, 2026-11-08 ~20:10): the brief
- [2026-11-08 20:12] (comment) seen again in claude-kit: question-brief-gate missed the Recommendation and Not asked lines of a brief that held them (session 9d88860c, 2026-11-08 ~20:10): the last two paragraphs read 'Recommendation: (Recommended) Keep loud, fix line, because ...' and 'Not asked: ...', yet the block listed both missing while finding Decis
- [2026-11-08 20:12] (asked again) 2026-11-08 — cap:bug:question-brief-gate-missed-the-recommendation-an
- [2026-11-08 20:13] (comment) @claude: Root-cause lead: the gate's counted block began 'I'm recommending keeping the loud protocol and fixing the line, since K (full comment #1 in ## Notes)
### comment #1 [2026-11-08 20:13] @claude
Root-cause lead: the gate's counted block began 'I'm recommending keeping the loud protocol and fixing the line, since KIT-D146 i' — text the session never wrote. The transcript the gate reads holds a rewritten/paraphrased copy of the assistant's text, and the rewrite drops the literal 'Not asked:' (and earlier 'Recommendation:') lines. The gate parses exact shapes out of text that is not verbatim.
- [2026-11-08 22:05] (comment) @claude: Checked by the kit agent 2026-11-08 against transcript 9d88860c: the string "Recommendation: (Recommended) Keep loud" oc (full comment #2 in ## Notes)
### comment #2 [2026-11-08 22:05] @claude
Checked by the kit agent 2026-11-08 against transcript 9d88860c: the string "Recommendation: (Recommended) Keep loud" occurs only inside Bash tool inputs (entry 1289, the cap command) and no text or narration block carries it; the replies of the two blocked calls (entries 1272 and 1335) hold no text block of their own. The counted blocks are real narration blocks (ids 1266 and 1329, filled text, narration signature: the gate counts these as prose since KIT-T893), so the block text "I'm recommending keeping the loud protocol..." is verbatim, not a paraphrase. Nothing in this transcript shows a brief containing the lines being missed by the matcher; the lead in comment #1 is not supported. Same-reply timing limit: see KIT-T881 Notes (Investigation 2026-11-08).
- [2026-11-08 22:08] (comment) @claude: Evidence (transcript 11b75d60..., 49 replies with prose): every narration block came from a reply with thinkingDurationM (full comment #3 in ## Notes)
### comment #3 [2026-11-08 22:08] @claude
Evidence (transcript 11b75d60..., 49 replies with prose): every narration block came from a reply with thinkingDurationMs 1-2; every text block that preceded a tool call came from a reply with thinkingDurationMs >= 1149 (e.g. request at line 95: 2182-char labelled brief stored as text, then Bash). Narration is lossy: request at line 902 produced 934 output tokens but 330 chars of narration + one Bash call were stored; 724 and 758 show the same gap. A reply with no tool call is always stored as text but ends the turn, so 'brief as the final message, then the cheap call' cannot happen in one turn. No reply shape a session controls reliably stores text, so the gate also accepts the brief when the questionnaire's own question text (headers, question, option label+description with the (Recommended) marker cut) satisfies the standard. Narration counting (KIT-T893) kept; policy fork open. Not-asked regex lives in hooks/lib/question-brief.mjs (added 'not in scope'). Tests: hooks/question-brief-labels.test.mjs 15 passed; question-brief-gate 41, narration 8, sections 14, turn 16, gate-protocol 34, question-gate, ids-described-gate 12, request-gate, land-alert all pass.
- [2026-11-08 22:08] (landed) 703df8b question-brief gate: text blocks only count as the reply, rejection lists the blocks read and flags a narration summary,
- [2026-11-09 21:03] (landed) 424fd59 question-brief audit judges only that a plain summary of reasonable length came first (text, narration or question text)
- [2026-11-09 21:04] (landed) e55f6a7 question-brief audit judges only that a plain summary of reasonable length came first (text, narration or question text)
- [2026-11-10 18:09] (status) todo → review
