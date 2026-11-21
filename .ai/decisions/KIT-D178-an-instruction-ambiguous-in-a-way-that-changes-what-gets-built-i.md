---
id: KIT-D178
title: An instruction ambiguous in a way that changes what gets built is asked first, never assumed
summary: When an instruction is ambiguous in a way that changes what gets built (scope, target, design fork), ask first in one batched questionnaire and then build; never assume.
date: 2026-11-21
supersedes: 
source: Chris 2026-08-05, Stiletto session; promoted to every project 2026-11-21
implemented_by: KIT-T1463
no_work: 
---


**Decision:** When an instruction is ambiguous in a way that changes what gets built (scope such as one turret against all turrets, target such as which input path, or a design fork), ask first in one batched questionnaire, then build. One question costs seconds; a wrong build costs an interruption, a revert and trust. The standing rule to ask when a subjective request is not obvious is not overridden by a bias to keep moving, and an auto mode's "make the reasonable call" applies to trivial and reversible calls, never to scope or design forks on an explicit ask.

**Maintainer:** "I sure wish you'd fucking discuss before flying off half-cocked" and "If I fucking say something that merits clarification, you need to speak the fuck up and not assume."

**Why:** in the Stiletto session a stick-inversion report got a derived keyboard fix that was wrong end to end, and the energy-turret scope was guessed narrow and corrected with "ALL TURRETS. Station or MMP".

**Assistant-added:** (unconfirmed) Origin: Stiletto decision ST-D008, promoted to every project by his approval of a questionnaire on 2026-11-21.
