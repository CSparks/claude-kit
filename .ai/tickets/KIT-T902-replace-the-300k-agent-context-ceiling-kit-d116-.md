---
id: KIT-T902
title: Replace the 300k agent context ceiling (KIT-D116) with a waste detector: flag and stop an agent that spends tokens monitoring or observing o
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes: KIT-T988
superseded_by:
created: 2026-11-08T19:31:30Z
updated: 2026-11-11T03:21:25Z
fixed_commit: 3698ba6
---

## Description
Replace the 300k agent context ceiling (KIT-D116) with a waste detector: flag and stop an agent that spends tokens monitoring or observing output that changes nothing (polling builds or background tasks, re-reading unchanged output, repeated commands, no-change retries after a gate block). No size limit and no size warning; productive agents run at any size. Chris 2026-11-08: "I dont care about the tokens if they are being used to get work done. I dont want them wasted monitoring some verbose bullshit." Governing: the new KIT decision on no agent token ceiling.

kit-bug-shape: cap:feature:replace-the-300k-agent-context-ceiling-kit-d116-
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] dispatch.context_ceiling_tokens no longer gates retire, resume or replace anywhere (dispatch-guard, resume-check, agent-context, ladder config, roster, handback), with no size warning
- [x] waste share per agent is measured from the transcript (bash dumps, repeated lines, raw-log reads, polling), cached, and flagged above a conservative default (more than 50% avoidable and at least 5000 avoidable tokens) with the avoidable lines named and the measurements printed (KIT-D158 coordinator-tracks-waste clause)
- [x] resume-check warns about waste and never blocks; the handoff-before-replace gate stays only for an agent flagged for waste; the waiting rules (KIT-D115, KIT-D104) are unchanged
- [x] negative controls: a huge agent doing real work is never flagged, resumed-with-warning or held to a handoff; the contract text, README, patch-worker text and config carry no ceiling

## Plan
1.

## History
- [2026-11-08 19:31] (created) feature — Replace the 300k agent context ceiling (KIT-D116) with a waste detector: flag and stop an agent that spends tokens monitoring or observing o
- [2026-11-08 19:31] (comment) @claude: Chris 2026-11-08, completing the thought: "on a running task that's taking 20 minutes." The case to catch: an agent that (full comment #1 in ## Notes)
### comment #1 [2026-11-08 19:31] @claude
Chris 2026-11-08, completing the thought: "on a running task that's taking 20 minutes." The case to catch: an agent that watches a long-running task (a 20-minute build or test run) and spends tokens observing it instead of ending and being resumed from the finished log (KIT-D115). Governing decision KIT-D149 (no size ceiling; waste detection only).
- [2026-11-08 19:32] (comment) @claude: Chris 2026-11-08: "Anything where there is a need for deeper verbose analysis, the output should be written to a file an (full comment #2 in ## Notes)
### comment #2 [2026-11-08 19:32] @claude
Chris 2026-11-08: "Anything where there is a need for deeper verbose analysis, the output should be written to a file and then grepped." Prevention side of the waste detector: verbose output to a file, then searched; no inline reading. Candidate signal: a large tool result read inline by an agent. Governing: the new decision on verbose output.
- [2026-11-08 19:32] (comment) @claude: Chris 2026-11-08 amendment to the verbose-output rule: "Or scanned as needed." Reading a bounded slice of the output file is allowed; streaming the whole output is not. KIT-D150 revised.
- [2026-11-11 03:11] (landed) fc75249 WIP KIT-T902: waste measure replaces the context ceiling in agent-context (implements KIT-T902)
- [2026-11-11 03:11] (landed) 1c91cbc WIP KIT-T902: dispatch-context judges waste (implements KIT-T902)
- [2026-11-11 03:11] (landed) b0cc5ac WIP KIT-T902: resume-check warns about waste, never blocks on size (implements KIT-T902)
- [2026-11-11 03:12] (landed) 4e1e858 WIP KIT-T902: agent-format imports wasteFlag (implements KIT-T902)
- [2026-11-11 03:12] (landed) 8b1307d WIP KIT-T902: agent line carries the waste flag (implements KIT-T902)
- [2026-11-11 03:12] (landed) 26d357f WIP KIT-T902: waste imports (implements KIT-T902)
- [2026-11-11 03:12] (landed) 1f88e7e WIP KIT-T902: roster, handback and dispatch-guard use the waste flag (implements KIT-T902)
- [2026-11-11 03:13] (landed) e32fe4d WIP KIT-T902: wording (implements KIT-T902)
- [2026-11-11 03:14] (landed) 26cd0a3 WIP KIT-T902: wording (implements KIT-T902)
- [2026-11-11 03:14] (landed) 0007eb1 WIP KIT-T902: patch-worker text drops the size ceiling (implements KIT-T902)
- [2026-11-11 03:14] (landed) 93432aa WIP KIT-T902: contract text, no context size limit (implements KIT-T902)
- [2026-11-11 03:14] (landed) 46e40ca WIP KIT-T902: README and skill wording (implements KIT-T902)
- [2026-11-11 03:15] (landed) 0c86281 WIP KIT-T902: readLadder no longer reads a context ceiling (implements KIT-T902)
- [2026-11-11 03:15] (landed) 6a3d100 WIP KIT-T902: no CONTEXT_CEILING_TOKENS (implements KIT-T902)
- [2026-11-11 03:15] (landed) 31785f0 WIP KIT-T902: ladder doc (implements KIT-T902)
- [2026-11-11 03:16] (landed) 9820c22 WIP KIT-T902: config drops dispatch.context_ceiling_tokens (implements KIT-T902)
- [2026-11-11 03:16] (landed) 593a455 WIP KIT-T902: ladder test (implements KIT-T902)
- [2026-11-11 03:16] (landed) 1290d1a WIP KIT-T902: ladder test import (implements KIT-T902)
- [2026-11-11 03:16] (landed) bef5d9e WIP KIT-T902: breakdown test import (implements KIT-T902)
- [2026-11-11 03:17] (landed) 91b27b0 WIP KIT-T902: breakdown test names avoidable lines (implements KIT-T902)
- [2026-11-11 03:18] (landed) a856850 WIP KIT-T902: waste tests (implements KIT-T902)
- [2026-11-11 03:18] (landed) f489e48 WIP KIT-T902: healthy transcript control (implements KIT-T902)
- [2026-11-11 03:21] (comment) criterion added: dispatch.context_ceiling_tokens no longer gates retire, resume or replace anywhere (dispatch-guard, resume-check, agent-context, ladder config, roster, handback), with no size warning
- [2026-11-11 03:21] (comment) criterion added: waste share per agent is measured from the transcript (bash dumps, repeated lines, raw-log reads, polling), cached, and flagged above a conservative default (more than 50% avoidable and at least 5000 avoidable tokens) with the avoidable lines named and the measurements printed (KIT-D158 coordinator-tracks-waste clause)
- [2026-11-11 03:21] (comment) criterion added: resume-check warns about waste and never blocks; the handoff-before-replace gate stays only for an agent flagged for waste; the waiting rules (KIT-D115, KIT-D104) are unchanged
- [2026-11-11 03:21] (comment) criterion added: negative controls: a huge agent doing real work is never flagged, resumed-with-warning or held to a handoff; the contract text, README, patch-worker text and config carry no ceiling
- [2026-11-11 03:21] (landed) 3698ba6 KIT-T902: gate-protocol test names WASTE_CHECK (implements KIT-T902)
- [2026-11-11 03:21] (comment) ticked: waste share per agent is measured from the transcript (bash dumps, repeated lines, raw-log reads, polling), cached, and flagged above a conservative default (more than 50% avoidable and at least 5000 avoidable tokens) with the avoidable lines named and the measurements printed (KIT-D158 coordinator-tracks-waste clause)
- [2026-11-11 03:21] (comment) ticked: resume-check warns about waste and never blocks; the handoff-before-replace gate stays only for an agent flagged for waste; the waiting rules (KIT-D115, KIT-D104) are unchanged
- [2026-11-11 03:21] (comment) ticked: negative controls: a huge agent doing real work is never flagged, resumed-with-warning or held to a handoff; the contract text, README, patch-worker text and config carry no ceiling
- [2026-11-11 03:21] (status) todo → review
- [2026-11-11 03:21] (comment) Built: waste measure replaces the context ceiling (fc75249..3698ba6); runtime publish blocked on the KIT-T944 commit
- [2026-11-11 03:21] (comment) ticked: dispatch.context_ceiling_tokens no longer gates retire, resume or replace anywhere (dispatch-guard, resume-check, agent-context, ladder config, roster, handback), with no size warning
- [2026-11-11 03:22] (landed) f57609d tickets: KIT-T902 built and in review, KIT-T988 superseded by it, KIT-D158 restates KIT-D149 (implements KIT-T902)
