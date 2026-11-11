---
id: KIT-D150
title: Verbose output goes to a file and is searched or scanned as needed, never streamed whole into the transcript
summary: Any analysis that produces verbose output (build, test, log, dump) is written to a file, then searched or scanned in the parts needed; the full output never lands in the agent's context
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
revised: 2026-11-08
---


**Maintainer:** "Anything where there is a need for deeper verbose analysis, the output should be written to a file and then grepped." Then: "Or scanned as needed."

**Decision:** When a task needs deeper verbose analysis (build output, test runs, logs, dumps, long diffs), the command writes its output to a file and the agent searches that file or scans the parts it needs. The full verbose output is never streamed into or tailed in the agent's context. This applies to orchestrators and every dispatched agent, and is the main preventive for the waste KIT-D149 targets.

**Why:** Same exchange as KIT-D149: tokens spent observing verbose output that changes nothing are the waste he objects to.

**Assistant-added:** Search tool: the kit rule is q, never grep (q scans a directory with --dir, including a scratchpad). The maintainer said "grepped" or "scanned"; scanning a bounded slice of the file (a line range, the failing section) is allowed. Whether a plain text filter on a log file is allowed alongside q is not ruled, so agents search with q --dir where it works and report any case it cannot cover (q feature gap) instead of grepping silently. Enforcement idea for KIT-T902: flag a large tool result read inline by an agent.
