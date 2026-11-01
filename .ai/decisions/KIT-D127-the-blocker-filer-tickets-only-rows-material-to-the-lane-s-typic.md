---
id: KIT-D127
title: The blocker filer tickets only rows material to the lane's typical job; the ranking still shows every row
summary: A ranked blocker becomes a kit ticket only when its per-job cost is at least a twentieth of the lane's typical job (queue + command time per job across the lane's history). Rows below it stay in `broker blockers` and the profile. This refines KIT-D121 (no static seconds) with a proportion of the lane's own work, and stops the hourly tick filing high-priority bugs for seconds of waste.
date: 2026-11-01
supersedes: 
source: Eight broker time sink tickets (KIT-T764, T773, T774, T786, T788, T790, T794, T795) read against dirt-empire's recorded jobs
---


**Decision:** `timingTick` files only rows where `isMaterial(row)` holds: `jobShare = perJobMs / typicalJobMs >= 0.05`. `typicalJobMs` is the lane's mean queue + compile + test + command time per job over all samples up to now. No number of seconds is involved; a quiet window cannot make seconds of waste look large.

**Why:** the tick filed the top three rows of every kind as high-priority bugs, however small. KIT-T794 and KIT-T795 were `rebuild rg-meshkit-script` at 1 to 2 s a job (1% of the lane's typical job) ranked top because the window held a handful of jobs. No dirt-empire job in the window passed the KIT-D104 ceiling on run time; the biggest per-job rows were 0.4 to 3 min. Sibling tickets (KIT-T776, T778, T782) were closed by Chris on 2026-11-01 as "ranking, not a defect".

**Not changed:** ranking (`broker blockers`), levers, flagged and dirty data, the out-of-reach test auto-skip (KIT-Q005 lever 2B stays gated on its own evidence).
