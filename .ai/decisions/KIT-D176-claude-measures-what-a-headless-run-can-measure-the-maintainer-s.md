---
id: KIT-D176
title: Claude measures what a headless run can measure; the maintainer's UAT is for feel, look and sound only
summary: Every defect class a headless run can measure, starting with every class he has already reported, is measured before a hand-off; a UAT step goes to him only after that is green and only for feel, look and sound; a red test on main blocks, never skipped into a landing.
date: 2026-11-21
supersedes: 
source: Chris 2026-10-30, Dirt Empire session; promoted to every project 2026-11-21
implemented_by: KIT-T1463
no_work: 
---


**Decision:** Every defect class a headless run can measure is measured before a hand-off, starting with every class the maintainer has already reported in the project. A UAT step goes to him only after that run is green, and only for what numbers cannot judge: feel, look and sound character. A test that is red on main is a blocker to fix, never a skip in a landing. A test that passes while the reported defect still exists does not count; the measure must exercise the defect he reported.

**Maintainer:** "Then WHY THE FUCK AM I TESTING WHAT YOU CAN FUCKING TEST?"

**Why:** in one UAT round the maintainer found spins, crackle, a pitch that never shifted, pop-in and an over-dense desert. Each was measurable headless; the landed tests watched narrower cases and one known-red test was skipped into a landing.

**Assistant-added:** (unconfirmed) the portable form of the project's list of finding classes (spins per km, first-draw distance, click count, pose jumps and so on): each project keeps its own list of classes he has reported and measures them. Origin: Dirt Empire decision DE-D075, promoted to every project by his approval of a questionnaire on 2026-11-21.
