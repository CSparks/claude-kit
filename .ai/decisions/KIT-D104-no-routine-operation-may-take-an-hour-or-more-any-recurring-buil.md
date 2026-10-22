---
id: KIT-D104
title: No routine operation may take an hour or more — any recurring build, test, gate, pin or suite run stays under 60 minutes wall clock
summary: Ceiling is 5 minutes, not 60. Chris 2026-10-21, verbatim: 'THERE SHOULDN'T FUCKING BE ANYTHING THAT ROUTINELY TAKES MORE THAN 5 FUCKING MINUTES.' Every recurring build, test, gate, pin, verify or suite run finishes in under 5 minutes wall clock; over it is a bug to split, scope or speed up.
date: 2026-10-21
supersedes: 
source: 
revised: 2026-10-22
---


**Decision:** Chris 2026-10-21, verbatim: "THERE SHOULD BE NO FUCKING ACTION TAKEN THAT ROUTINELY REQUIRES A FUCKING 1 HOUR PLUS OPERATION OF ANY FUCKING KIND." Every recurring operation the kit or a project runs — broker gates, auto-pins, landing verifies, scheduled/idle full-suite runs, prebuilds — finishes in under 60 minutes wall clock on the dev box. An operation that exceeds it is a bug: it is split, scoped or made faster, never accepted as the cadence's cost. A nightly or idle run is routine and falls under the same ceiling.

**Why:** stiletto auto-pins of rapid-game ran full `cargo t` per landing: j-mvivxu9l 126 min, j-mviqcf1n 125 min, both red; rapid-game lane jobs ran 11–31 min. Stiletto `auto_pin` set false in stiletto `.ai/config.yml` the same turn until the scoped pin (ST-D254) is live.

**Rejected:** treating a long run as acceptable because it is automatic, backgrounded, or nightly.
