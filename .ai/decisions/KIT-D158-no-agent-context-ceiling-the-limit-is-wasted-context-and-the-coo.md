---
id: KIT-D158
title: No agent context ceiling; the limit is wasted context, and the coordinator tracks it
summary: The 300k-token agent context ceiling (KIT-D116) is removed; an agent is retired only for context filled with terminal-output watching, polling or raw logs, which the session coordinator tracks
date: 2026-11-10
supersedes: KIT-D116
source: conversation 2026-11-10 (Chris)
---


**Maintainer:** "Get rid of the ocntext limit as long as it's not context full of fucking bullshit from watching a terminal task. Real work is OK. This is a job for the session coordinating agent to keep track of. The point is to keep agetns from wasting tokens staring at a fucking task output."

**Decision:** (1) The total-token context ceiling (dispatch.context_ceiling_tokens, 300k; KIT-D116) is removed: an agent is never retired, blocked from resuming, or replaced because its context is large. Real work (reads, edits, reasoning, tests it wrote) is fine at any size. (2) The only limit is waste: context filled by watching a terminal task, polling, repeated progress lines, raw build or test logs, and bash dumps. The session coordinating agent tracks it per agent from the composition the resume check already measures (bash dumps, repeated lines, raw-log reads) and retires or redirects an agent whose waste share is high, with the avoidable lines named. (3) The agent waiting rules stay (KIT-D115, KIT-D104): no polling, loops or background waits; read results through result summaries, never the raw log. (4) The resume-check and dispatch-guard hooks stop gating on total tokens; they gate on, or at most warn about, the waste share. The handoff-before-replace gate stays for an agent the coordinator retires for waste.

**Why:** Chris 2026-11-10. The ceiling forced retirement of writers whose context was mostly real work, and cost handoff turns; the actual waste is agents staring at task output.

**Assistant-added:** the waste threshold is not ruled; the kit agent picks a conservative default (candidate: retire when more than half of context is avoidable lines) and prints the measurements. Until the hooks change, `[resume-over-ceiling: <reason>]` quoting this decision is the documented override.

## Notes
Restates KIT-D149 (no size ceiling; waste is the limit). The only addition is the clause that the session coordinator tracks the waste share per agent; built by KIT-T902 (waste measure, 50% default threshold, 5000 avoidable tokens floor, avoidable lines named). KIT-T988 closed as a duplicate of KIT-T902.
