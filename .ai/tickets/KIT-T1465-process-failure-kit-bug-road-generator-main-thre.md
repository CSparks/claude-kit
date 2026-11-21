---
id: KIT-T1465
title: process failure + kit bug (road-generator main thread, 2026-11-21): a questionnaire was blocked by the question-grounded gate, and the resen
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1448, KIT-T893]
files: []
supersedes:
superseded_by:
created: 2026-11-21T14:50:58Z
updated: 2026-11-21T14:55:48Z
---

## Description
process failure + kit bug (road-generator main thread, 2026-11-21): a questionnaire was blocked by the question-grounded gate, and the resend carried only a one-line process-failure note above the call instead of the plain summary (the summary sat in the earlier message before the blocked call). The summary-above gate did not block the resend. The maintainer: 'Where is the fucking summary?' Rule: the plain summary (what is decided, what each option does and costs, recommendation, at least 40 words) must sit in the same message directly above every AskUserQuestion call, including a resend after a block. Fix: make the question gate require the summary text in the same assistant message immediately preceding the call, with no tool call between, and make its block text say to repeat the whole summary on a resend; add the resend case to the standing-rules block line. Reuse the existing summary-first check (KIT-D153 / D145 family).

kit-bug-shape: cap:bug:process-failure-kit-bug-road-generator-main-thre:2e6b260a
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a resend after a block needs its own whole summary (40+ words) directly above it; every refusal and the standing-rules line say so (question-brief-blocked 12 passed, question-gates-first-try 41 passed)

## Plan
1.

## Notes
Same fault family as KIT-T1448 (summary directly above the call) and KIT-T893 (narration blocks counted). KIT-T893 stands: it made narration count as prose and is unrelated to the resend. KIT-T1448 built the adjacency rule but kept one leniency in hooks/lib/turn-text.mjs: a call a PreToolUse hook refused did NOT separate, so a resend after a block 'kept' the long summary written above the blocked call and passed with a one-line note. BEFORE: the summary check was an after-the-call audit (advisory on PostToolUse, a block of the stop on Stop) that, for a resend, counted the text above the blocked call. NOW: a refused call separates like any other; the resend must carry its own summary (at least 40 words) in the same message directly above it, else the audit names the shortfall and the stop blocks. Every question-gate refusal (hooks/lib/question-gates-run.mjs) now says to repeat the whole summary on a resend; the audit text says the same; the standing-rules block questionnaire line ends 'and again on a resend' (all 15 agent definitions); contract paragraph updated. A pre-call block of the resend is impossible: Claude Code writes the reply after the PreToolUse hooks run, so the same-message text is unreadable then. Tests: hooks/question-brief-blocked.test.mjs 12 passed (resend with one line blocks; whole summary passes; 39 vs 40 words; denied call not judged), question-gates-first-try 41, question-brief-turn 22, -audit 22, -narration 14, -gate 27, question-grounded-gate 38, rule-block 31, gate-protocol 57, contract-rules 48.

## History
- [2026-11-21 14:50] (created) bug — process failure + kit bug (road-generator main thread, 2026-11-21): a questionnaire was blocked by the question-grounded gate, and the resen
- [2026-11-21 14:55] (comment) criterion added: a resend after a block needs its own whole summary (40+ words) directly above it; every refusal and the standing-rules line say so (question-brief-blocked 12 passed, question-gates-first-try 41 passed)
- [2026-11-21 14:55] (comment) ticked: a resend after a block needs its own whole summary (40+ words) directly above it; every refusal and the standing-rules line say so (question-brief-blocked 12 passed, question-gates-first-try 41 passed)
- [2026-11-21 14:55] (status) todo → review
