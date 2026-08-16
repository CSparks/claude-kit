---
id: KIT-D066
title: Chris, 2026-08-15, verbatim: "If you had said 'Inventory screen blown out white' that would've rung a bell. 'Blown-white offscreen UI' is…
date: 2026-08-16
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** Chris, 2026-08-15, verbatim: "If you had said 'Inventory screen blown out white' that would've rung a bell. 'Blown-white offscreen UI' is bullshit and you should NEVER talk like that... not getting directly to the most descriptive version of the information you're trying to convey." Rule: when presenting any past bug/ticket/item to the maintainer (questionnaires ESPECIALLY, but all prose too), lead with the USER-VISIBLE SYMPTOM in his words — what he saw on screen — never the internal/system framing (component names, camera/render terminology, agent shorthand). Repeat offense class: memory "questionnaires-carry-content-not-ids" already existed; this sharpens it — content means SYMPTOM-FIRST content. Wants: codify in CLAUDE.md base (questionnaire + receipt style rule) and/or the decide/triage skill prompts.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
