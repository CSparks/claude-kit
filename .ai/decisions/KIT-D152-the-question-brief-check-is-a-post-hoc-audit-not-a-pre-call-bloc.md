---
id: KIT-D152
title: The question-brief check is a post-hoc audit, not a pre-call block
summary: Amends KIT-D129 and KIT-D136: AskUserQuestion goes through; a PostToolUse hook with a Stop backstop audits the on-disk summary and tells the model what to add and to re-ask
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
---


**Maintainer:** answered the questionnaire "How should the question-brief gate check a summary, now that a pre-call read cannot see a same-reply summary?" with "(Recommended) Post-hoc audit instead of a pre-call block". Earlier: "The process should be Summary to inform the questionnaire, then the questionnaire."

**Decision:** The question-brief check (KIT-T846) no longer blocks AskUserQuestion before the call. A PostToolUse hook on AskUserQuestion, with a Stop-hook backstop, reads the reply once it is on disk, judges the summary with the existing briefProblems checks, and tells the model exactly what to write and to re-ask. Each audit names the missing parts. Misses are counted per session and project so orient can show a repeat offender. The summary requirement itself (a full summary above every questionnaire, KIT-D129 and KIT-D136) stays; only the enforcement point moves from before the call to after it. The pre-call settle wait of 3 s goes away.

**Why:** At PreToolUse the call's own reply is not yet on disk (KIT-T881 investigation, KIT-D151), so a pre-call read cannot see a same-reply summary and the first call bounces. The maintainer explicitly approved the loosening and its cost: he can see and answer one thin questionnaire before the correction.

**Assistant-added:** Amends KIT-D129 and KIT-D136 (enforcement point) and extends KIT-D151. The decision-gate (KIT-T744) was fixed separately under KIT-T907. Not verified live: that Claude Code passes PostToolUse additionalContext to the model for AskUserQuestion; the kit agent verifies that first and reports.
