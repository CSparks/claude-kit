---
id: KIT-D151
title: The questionnaire process is a summary, then the questionnaire; no workaround step and no first-call block
summary: Amends KIT-D142: a questionnaire follows its summary directly; the kit gates must not block a good one, and a resend or extra tool call to pass them is a bug
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
---


**Maintainer:** "Because I do not wnat to be seeing tha tbig fuckign error all the fucking time. If you have to hit that first, then there's a bug in the process." and "The process should be Summary to inform the questionnaire, then the questionnaire."

**Decision:** The process is: write the summary that informs the questionnaire, then send the questionnaire. No cheap tool call between them (the KIT-D142 workaround is not the process), no blocked first attempt, and no unchanged resend to get through. A kit gate that blocks a questionnaire with a sound summary above it, or blocks the first call and passes the identical resend (decision-gate KIT-T744, question-brief gate KIT-T846), is a kit bug and is fixed, not worked around. The summary requirement itself (KIT-D129, KIT-D136) stays.

**Why:** Chris 2026-11-08, after both questionnaires in the groovegrid session hit the decision-gate block and needed a resend, and an earlier one needed the extra tool call to get past the question-brief gate.

**Assistant-added:** Amends KIT-D142. The question-brief gate cannot read a same-reply summary at PreToolUse (KIT-T881 diagnosis), so making this process work may need a different design (for example a post-hoc audit instead of a pre-call block); loosening a gate needs Chris's word, so the kit agent reports that choice to him. Tickets KIT-T907 (decision-gate) and KIT-T881.
