---
id: KIT-D173
title: The plain summary goes in text directly above the questionnaire, never inside it
summary: Every questionnaire is preceded by a plain-text summary in the same message; the questions themselves stay one short sentence plus options and never embed or repeat the summary.
date: 2026-11-21
supersedes: 
source: Chris 2026-11-20, road-generator session
implemented_by: KIT-T1463
no_work: 
---


**Decision:** The plain summary of a decision (what is decided, what each option does and costs, the recommendation) is text in the message directly above the questionnaire call, in the same message with no tool call between. It never goes inside the questionnaire: each question stays one short sentence plus its options and never embeds or repeats the summary. A re-ask needs its own summary above it.

[amends: KIT-D153]

**Maintainer:** "The fucking summary does not go into the questionnaire."

**Why:** stated by the maintainer. A summary embedded in the question text buries the options and is read as a wall of text inside a form; above the call it reads as the explanation it is.

**Assistant-added:** (unconfirmed) the kit's question gates already require a summary in the same message above the call; the gap was the wording that let it be folded into the question, closed in the standing-rules block and the base contract.
