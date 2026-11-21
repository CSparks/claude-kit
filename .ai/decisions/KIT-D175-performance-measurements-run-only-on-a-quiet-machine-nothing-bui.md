---
id: KIT-D175
title: Performance measurements run only on a quiet machine: nothing building, no tests running, CPU checked first
summary: Before any benchmark or performance check, make sure nothing is building and no tests run, check CPU use first and record it; a number taken under load is not a result and decides nothing.
date: 2026-11-21
supersedes: 
source: Chris 2026-11-13, road-generator session; promoted to every project 2026-11-21
implemented_by: KIT-T1463
no_work: 
---


**Decision:** Before any benchmark or performance check (a frame probe, a cook bench, any timing that will be reported or decide something), the session makes sure no tests are running and nothing is building, and checks the machine's CPU utilisation. A measurement is taken only on a quiet machine and records the utilisation it was taken under. A number taken under load is not reported as a result and decides nothing. A project may be stricter: Stiletto's rule is that speed-dependent runs (timing probes, benches) run strictly alone, never beside a build or another test, while correctness-only builds and tests may overlap within the machine's memory limit, builds first and already-built functional tests running concurrently (Stiletto decision ST-D184).

**Maintainer:** "You should make sure no tests are running and nothing is building. Check the CPU utilization before running benchmark related performance checks."

**Why:** stated by the maintainer after flight frame times were measured while other agents' builds and test runs used the machine: the same leg read twice as slow three hours apart with nothing relevant changed.

**Assistant-added:** (unconfirmed) enforcement belongs in the measuring tool: check for running build and test processes and sample CPU before a timed run, print both with the results and mark the run unfit above a threshold. Origin: road-generator decision RDG-D060, promoted to every project by his approval of a questionnaire on 2026-11-21.
