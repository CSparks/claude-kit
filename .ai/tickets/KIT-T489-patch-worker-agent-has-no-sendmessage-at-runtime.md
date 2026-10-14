---
id: KIT-T489
title: patch-worker agent has no SendMessage at runtime: agents/patch-worker.md lists SendMessage in tools (KIT-T483) but the dispatched sonnet wor
type: bug
status: review
priority: critical
asked: 3
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T20:21:10Z
updated: 2026-10-14T20:41:13Z
---

## Description
patch-worker agent has no SendMessage at runtime: agents/patch-worker.md lists SendMessage in tools (KIT-T483) but the dispatched sonnet worker reported 'I have no SendMessage tool', so no landed-job ping and no 10-minute wait ping reached the orchestrator (stiletto ST-T904 vetting, job j-mv8iws2u-5h6zad). Either the harness does not grant SendMessage to subagents or the definition is not the one dispatched; find which and make the ping path real (or drop the instruction).

kit-bug-shape: cap:bug:patch-worker-agent-has-no-sendmessage-at-runtime
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 20:21] (created) bug — patch-worker agent has no SendMessage at runtime: agents/patch-worker.md lists SendMessage in tools (KIT-T483) but the dispatched sonnet wor
- [2026-10-14 20:22] (comment) seen again in stiletto-2349: patch-worker agent has no SendMessage at runtime: agents/patch-worker.md lists SendMessage in tools (KIT-T483) but the dispatched sonnet worker reported 'I have no SendMessage tool', so no landed-job ping and no 10-minute wait ping reached the orchestrator (stiletto ST-T904 vetting, job j-mv8iws2u-5
- [2026-10-14 20:22] (asked again) 2026-10-14 — cap:bug:patch-worker-agent-has-no-sendmessage-at-runtime
- [2026-10-14 20:23] (asked again) 2026-10-14 — cap:bug:patch-worker-agent-has-no-sendmessage-at-runtime
- [2026-10-14 20:41] (comment) @claude: Root cause confirmed: sessions load agents, skills, commands and hooks/hooks.json from ~/.claude/plugins/cache/claude-ki (full comment #1 in ## Notes)
### comment #1 [2026-10-14 20:41] @claude
Root cause confirmed: sessions load agents, skills, commands and hooks/hooks.json from ~/.claude/plugins/cache/claude-kit/claude-kit/0.1.19, copied at cbc8b73 on 2026-10-07 and refreshed only when .claude-plugin/plugin.json's version changes. 20 plugin files had changed since (patch-worker tools, hooks.json, skills, commands, 14 agents). Fixed: version 0.1.20 in both manifests; publish:runtime now warns when plugin files drift under an unchanged version (scripts/plugin-drift.mjs, plugin-drift.test.mjs 4 passed with a bumped-version negative control). Sessions pick it up at their next restart.
- [2026-10-14 20:41] (status) todo → review
