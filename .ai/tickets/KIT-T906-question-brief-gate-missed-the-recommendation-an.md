---
id: KIT-T906
title: question-brief-gate missed the Recommendation and Not asked lines of a brief that held them (session 9d88860c, 2026-11-08 ~20:10): the brief
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T20:12:35Z
updated: 2026-11-08T20:12:35Z
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
