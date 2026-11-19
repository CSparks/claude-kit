---
id: KIT-D170
title: A dispatch's model follows the assessed difficulty of its job, never the agent definition file or the agent type's default job
summary: The family and effort of a dispatch come from a difficulty assessment of the specific job (the KIT-T1414 rubric) per the KIT-D169 ladder; an agent definition's default job is a fallback only when no assessment is given, and no agent definition encodes a model or a difficulty.
date: 2026-11-18
supersedes: 
source: Chris 2026-11-18, relayed verbatim by the road-generator coordinator, on KIT-T1414
implemented_by: KIT-T1414
no_work: 
---


**Maintainer:** "Because that's really more of how we need to be assigning agents. It shouldn't be based on an agent definition file."

**Decision:** The model (family and effort) of every dispatch follows the ASSESSED DIFFICULTY of the specific job, scored with the KIT-T1414 rubric and mapped to a family by the KIT-D169 ladder (Fable extremely difficult and deep, Opus very hard, Sonnet medium, Haiku mostly automation). The agent type says WHAT the agent does (its tools and conventions); it never decides HOW HARD the job is. A dispatch carries its assessment; the dispatch gate and `dispatch-ladder resolve` derive the family from it, and fall back to the agent definition's default job only when no assessment is given. No agent definition encodes a model or a default difficulty. Predictions and outcomes are recorded per dispatch so the rubric can be calibrated.

**Why:** stated by the maintainer: assignment by agent definition file put the same family on every job an agent type takes, whatever its difficulty.

[restates-ok: the family names repeat the KIT-D169 ladder this decision applies; KIT-D042, KIT-D060 and KIT-D061 are the older tier ladders KIT-D169 and KIT-D080 replaced]

[amends: KIT-D088] its job-typed dispatch stays (every dispatch names a job), but the family now follows the job's assessed difficulty rather than the job row alone.

**Relates:** KIT-D088 (amended), KIT-D169 (the difficulty ladder this applies), KIT-D080 (no pinned agents; the orchestrator picks the family from one capability table; this decision moves the pick from the job row to the assessed job). Tickets: KIT-T1414.
