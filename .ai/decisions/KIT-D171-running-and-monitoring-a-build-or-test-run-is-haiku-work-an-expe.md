---
id: KIT-D171
title: Running and monitoring a build or test run is Haiku work; an expensive agent queues its run and ends
summary: A job that only submits a run, waits for its finished.log line and reads the result runs on haiku (the run-monitor job); an Opus, Sonnet or Fable agent never waits on or polls a run itself.
date: 2026-11-18
supersedes: 
source: Chris 2026-11-18, relayed verbatim by the road-generator coordinator
implemented_by: KIT-T1414
no_work: 
---


**Maintainer:** "Agents running and monitoring if ever that's needed from an actual agent should be Haiku."

**Decision:** The capability table gains a `run-monitor` job on haiku: submit a broker or `builds --run` run with its limit, wait on the run's finished.log line, read the result with the sanctioned filters (`builds --result`, `q code <regex> --regex --dir <output file>`, Read with offset), and report pass or fail with the failing lines. An expensive agent (sonnet, opus, fable) never waits on or polls a run itself: it queues the run, writes its handoff naming the run id, and ends; a Haiku run-monitor, or the coordinator's Monitor on finished.log, collects the result and resumes it with the filtered numbers.

**Why:** stated by the maintainer: waiting on a run is automation, the Haiku rung of the KIT-D169 ladder.

[restates-ok: the queue-then-end rule repeats the wait rule (KIT-D115, KIT-T1283) and names who collects the result; the new part is the haiku run-monitor job]

**Relates:** KIT-D169 (the ladder: Haiku for mostly automation), KIT-D170 (assessed difficulty), KIT-D115 (no agent waits). Tickets: KIT-T1414.
