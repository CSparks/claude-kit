---
id: KIT-T872
title: question-brief-gate rejected AskUserQuestion 3x in dirt-empire 2026-11-06 though the prose brief was a full text message in the same turn na
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T865, KIT-T867, KIT-T856, KIT-T854, KIT-T846]
files: []
supersedes: KIT-T867
superseded_by:
created: 2026-11-06T21:29:09Z
updated: 2026-11-06T22:00:40Z
---

## Description
question-brief-gate rejected AskUserQuestion 3x in dirt-empire 2026-11-06 though the prose brief was a full text message in the same turn naming every option, with recommendation and not-asked. Reports 'reply has no text block' and 'Square panel not named'. Duplicates open KIT-T865/T867; add this evidence.

kit-bug-shape: cap:bug:question-brief-gate-rejected-askuserquestion-3x-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] diagnosed from the real transcripts: of the observed blocks the call's reply held only thinking blocks (dirt-empire cc0a01b7 entries 313-315, pixelvision 0c60656b 492-494 and 504-506, stiletto c17d9055 1413-1414 and 1419-1421), so 'no text block' was true; the one exception is a reply whose text had not reached the transcript at hook time (dirt-empire entries 303-305: replaying the hook on the file up to entry 303 reproduces the observed message exactly)
- [x] a call whose own tool_use entry never reaches the transcript is told the reply has not been flushed and to resend unchanged, never that it has no text block; question-brief-gate 41 passed incl. a same-reply full brief with the four radar labels passing and negative controls (one-line brief, unnamed option, thinking-only reply)

## Plan
1.

## Notes
Root cause: the gate is right when the reply holds only thinking (every observed case but one: the model wrote the brief in its thinking block, which the maintainer never sees). The one fault is the unflushed case: PreToolUse fires before the transcript holds the call's own reply, the 3 s settle wait times out (every blocked call took 3.5-4.1 s), and the gate then read earlier replies only yet claimed the call's reply had no text block. Replay of dirt-empire cc0a01b7 (entry 305's call) over the file truncated at 303 gives the observed message; truncated at 304 it drops the false claim. Option labels were never the problem: '(Recommended) Heading-up' etc. pass when the brief names them (test). Fix a9382a4: lib/turn-text.mjs turnTextForCall returns replyUnflushed; the gate says so and tells the sender to resend unchanged (the reply is in the transcript by then, as the blocked-call tool_result forces the flush). Thresholds untouched. Also seen: dirt-empire entry 296 (the 'brief') named neither Square panel nor a recommendation, so those blocks were legitimate; decision-gate's 'resend unchanged' lets a model resend with a one-line text, which then meets this gate (not changed here).
Published runtime a9382a4 (npm run publish:runtime, exit 0; current -> a9382a4). Test list: hooks/question-brief-gate.test.mjs, 41 passed.

## History
- [2026-11-06 21:29] (created) bug — question-brief-gate rejected AskUserQuestion 3x in dirt-empire 2026-11-06 though the prose brief was a full text message in the same turn na
- [2026-11-06 21:35] (comment) @claude: Correction 2026-11-06: filing overstated it. Of 3 blocked calls: #1 decision-gate (legit; resend-unchanged was the hook' (full comment #1 in ## Notes)
### comment #1 [2026-11-06 21:35] @claude
Correction 2026-11-06: filing overstated it. Of 3 blocked calls: #1 decision-gate (legit; resend-unchanged was the hook's instruction). #2 brief-gate on a one-line brief that never named 'Square panel' (my fault, gate right). #3 brief-gate on a full same-reply brief: gate said 'no text block, counted earlier replies' and 'Square panel not named' though named. Only #3 is the kit bug (likely T865/T867). Gate source not read.
- [2026-11-06 21:54] (landed) a9382a4 question-brief-gate: a call whose own reply is not in the transcript yet is told to resend unchanged, never that its rep
- [2026-11-06 21:58] (comment) criterion added: diagnosed from the real transcripts: of the observed blocks the call's reply held only thinking blocks (dirt-empire cc0a01b7 entries 313-315, pixelvision 0c60656b 492-494 and 504-506, stiletto c17d9055 1413-1414 and 1419-1421), so 'no text block' was true; the one exception is a reply whose text had not reached the transcript at hook time (dirt-empire entries 303-305: replaying the hook on the file up to entry 303 reproduces the observed message exactly)
- [2026-11-06 21:58] (comment) criterion added: a call whose own tool_use entry never reaches the transcript is told the reply has not been flushed and to resend unchanged, never that it has no text block; question-brief-gate 41 passed incl. a same-reply full brief with the four radar labels passing and negative controls (one-line brief, unnamed option, thinking-only reply)
- [2026-11-06 21:58] (comment) ticked: diagnosed from the real transcripts: of the observed blocks the call's reply held only thinking blocks (dirt-empire cc0a01b7 entries 313-315, pixelvision 0c60656b 492-494 and 504-506, stiletto c17d9055 1413-1414 and 1419-1421), so 'no text block' was true; the one exception is a reply whose text had not reached the transcript at hook time (dirt-empire entries 303-305: replaying the hook on the file up to entry 303 reproduces the observed message exactly)
- [2026-11-06 21:58] (comment) ticked: a call whose own tool_use entry never reaches the transcript is told the reply has not been flushed and to resend unchanged, never that it has no text block; question-brief-gate 41 passed incl. a same-reply full brief with the four radar labels passing and negative controls (one-line brief, unnamed option, thinking-only reply)
- [2026-11-06 22:00] (status) todo → review
