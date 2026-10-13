---
id: KIT-T461
title: Process failure, 3rd report (Chris 2026-10-13: 'Still seeing agetns running in multiple terminals without indicating the model they're using
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T21:27:10Z
updated: 2026-10-13T22:28:54Z
---

## Description
Process failure, 3rd report (Chris 2026-10-13: 'Still seeing agetns running in multiple terminals without indicating the model they're using. How many fucking times have I asked for this and it's still not being gated and enforced.'). KIT-T337 (ca308c0) and KIT-T403 claimed enforcement, but rows still show no model. Known ungated paths per KIT-T337's own notes: background Bash shells (run_in_background, e.g. 'ChunkGround reference search' from a subagent) list beside agents with no model; SendMessage resumes and Workflow agent() fire no Agent PreToolUse; sessions started before a hook change may run old hook registrations (dirt-empire-3a is 8 days old). Root cause: enforcement covered one dispatch path (Agent PreToolUse) instead of every row the maintainer sees. Fix: enumerate every path that puts a row in the agent/task panel and gate or tag each; test per path; orient/standup flag any live unlabelled row across ALL sessions.

kit-bug-shape: cap:bug:process-failure-3rd-report-chris-2026-10-13-stil
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 21:27] (created) bug — Process failure, 3rd report (Chris 2026-10-13: 'Still seeing agetns running in multiple terminals without indicating the model they're using
- [2026-10-13 22:28] (comment) @claude: Path table (2026-10-13). Test files: hooks/panel-rows.test.mjs (29), hooks/live-agents.test.mjs (15), scripts/is-main.te (full comment #1 in ## Notes)
### comment #1 [2026-10-13 22:28] @claude
Path table (2026-10-13). Test files: hooks/panel-rows.test.mjs (29), hooks/live-agents.test.mjs (15), scripts/is-main.test.mjs (5), hooks/activity-tag.test.mjs (26, existing).
path | gated/tagged | test | not hookable because
Agent/Task dispatch | tagged by activity-tag, gated by dispatch-guard (adopted repos only) | activity-tag.test.mjs | -
Agent dispatch evidence | meta.json of every agent in ~/.claude/projects, 12 days: 219 tagged, 14 untagged. Today: 60 tagged, 0 untagged. All 14 untagged are general-purpose/Explore agents titled 'Submodule diff/bump security review' in stiletto (2026-10-06..12), no model in their meta, prompt text 'Investigate a submodule pointer bump'. They were not started by a kit-visible Agent call. | - | harness-spawned; our PreToolUse never sees the call. Origin not proven (security review of a submodule pin bump).
background Bash / PowerShell, main thread | tagged by row-tag: description = [Model] description (command when no description) | panel-rows.test.mjs | -
background Bash / PowerShell, subagent | tagged by row-tag from the subagent's own sidechain transcript (hooks fire inside subagents; transcript_path is subagents/agent-<id>.jsonl, verified by progress-store), meta.json model when no turn yet, [model?] when unknown | panel-rows.test.mjs | -
Monitor | tagged by row-tag | panel-rows.test.mjs | -
Workflow agent() | gated by workflow-gate: every agent() needs model: and a label starting with [Model]; a script run by name cannot be read, passes with a notice | panel-rows.test.mjs | agent() calls inside the script fire no PreToolUse, so the label cannot be rewritten per call; the script lint is the next-best enforcement
SendMessage resume | creates no row; the row keeps its dispatch label. resume-check warns when the roster row has no model; orient flags it | panel-rows.test.mjs | nothing to rewrite, nothing created
Roster/orient | orient lists all live agents on the machine (all sessions) with model, job, table row, !! on no model / no job / model off the table row; status-only rows (SubagentStop with no dispatch) are counted apart, no longer 'carry no model' | live-agents.test.mjs | -
Mutation checks: row-tag tag removed fails 6, foreground guard removed fails 1, workflow-gate exit 2 removed fails 2, resume-check warning removed fails 1; live-agents model-row check removed fails 3, dispatch-row definition removed fails 2, idle window removed fails 2.

Old sessions. All four running claude.exe were started with --plugin-dir D:\dev\claude-kit by the PowerShell profile wrapper (Documents\WindowsPowerShell\profile.ps1, $kit = 'D:\dev\claude-kit'): pid 20100 (2026-10-02 12:04), 28592 (10-05 10:39, --resume), 33232 (10-12 21:19), 38032 (10-13 13:14). Script CONTENT is live for all of them (hooks run node D:/dev/claude-kit/hooks/compat-run.mjs), so every behaviour change in an already-registered hook applies at once. Hook REGISTRATIONS (hooks.json) are read at session start: activity-tag, dispatch-guard and agent-roster are registered in all four (since 2026-08-05 / 07-23 / 06-10), so the Agent tag needs no restart. Missing by start time: 20100 and 28592 lack upstream-gate (10-08), wait-poll (10-12), shell-writes, commit-stamp, reask-gate; 33232 lacks wait-poll, shell-writes, commit-stamp, reask-gate; 38032 lacks reask-gate. Today's row-tag, workflow-gate and resume-check are in none of them: all four sessions need a restart (or /reload-plugins, untested) to get the new gates.
Live view finding: the 14 agents live in D:\dev\the-commodore\mkt-workspace\mkt-generic are all tagged Opus 5.5 and carry no [job: x]. That tree is in the registry's excluded list (KIT-T447, kit OFF, by design), so the job gate never applies there. orient now shows those rows as 'kit OFF (excluded tree)' and owes them no job; they still need a model. In any non-excluded repo without .ai, dispatch-guard (and so the job gate) no-ops by the hook contract; say if that should change.
- [2026-10-13 22:28] (comment) @claude: (fixed) e5d8abd 571ce49. Test evidence: hooks/panel-rows.test.mjs 29, hooks/live-agents.test.mjs 16, scripts/is-main.test.mjs 5; mutations recorded in the comment; npm test green (publish:runtime)
- [2026-10-13 22:28] (status) todo → review
