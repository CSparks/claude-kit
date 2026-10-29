---
id: KIT-D113
title: An agent bypassing a kit tool is a kit defect, closed with a hard block
summary: Any agent rolling its own replacement for a kit tool (tail|grep instead of broker/wait.mjs, grep instead of q) is a kit failure; the fix is a blocking gate plus closing the capability gap, never a hint
date: 2026-10-29
supersedes: 
source: conversation 2026-10-29
---


**Decision:** When an agent does a job with its own tooling where the kit has a tool for it, that is a kit defect, even when the agent's output was right. The fix has two parts:
(1) a hard-blocking gate that sends the shape to the kit tool;
(2) closing whatever the kit tool lacked that made the agent roll its own.
A reaper or cleanup for the after-effects is only a backstop.

Chris, verbatim: "This shit shouldn't be happening because agents should be using KIT and if they're not, that's still a fucking problem."

**Why:** On 2026-10-29 the maintainer reported sluggish input. The cause was 23 tail.exe and 22 grep.exe orphans, left by a dirt-empire orchestrator that watched broker logs with `tail -F | grep --line-buffered` instead of `broker/wait.mjs`. The watcher was re-armed about every 30 min through 2026-10-28, and every parent shell exited. KIT-T634 had already been filed for the same class (an orphaned grep that escaped the query-gate) and sat in todo. Cleanup alone lets the bypass recur. Tickets: KIT-T697, KIT-T633, KIT-T634.
