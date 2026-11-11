---
id: KIT-T1071
title: runtime publish only warns when agent, skill, command or hooks.json files change under an unchanged plugin.json version, so a text fix never
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T18:23:13Z
updated: 2026-11-11T18:59:49Z
---

## Description
runtime publish only warns when agent, skill, command or hooks.json files change under an unchanged plugin.json version, so a text fix never reaches sessions: KIT-T999 (5bb4e05) rewrote the wait rule in 15 agent definitions under 0.1.40, was published with that warning, and a groovegrid subagent still got the old max-timeout text 12 hours later (found 2026-11-11 under KIT-T1062). Fix: publish:runtime refuses (non-zero) on that drift unless plugin.json and .codex-plugin/plugin.json are bumped together, or bumps them itself; test with an agent file changed under an unchanged version plus a bumped negative control

kit-bug-shape: cap:bug:runtime-publish-only-warns-when-agent-skill-comm
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed 01179ca, live in runtime 01179ca. publish:runtime now calls guardedPublish(): scripts/plugin-drift.mjs publishCheck() refuses (throws before current moves, exit 1) when agent/skill/command/hook-wiring files changed since the plugin cache copy under an unchanged version, or when .claude-plugin/plugin.json and .codex-plugin/plugin.json versions differ; manifests are read from HEAD, not the working copy. An installed commit this repo lacks is a warning, no installed record is silent. Refusal names the files and says to bump both manifests and commit. No auto-bump (it would need a commit inside publish). Tests: plugin-drift 14 (refusal with current unchanged, mismatch, bump-both negative control, uncommitted bump does not lift it), runtime-publish 36, plugin-compat 150, agent-pins 18. Current repo state before publish: no drift (HEAD 0.1.41, cache 0.1.40).

## History
- [2026-11-11 18:23] (created) bug — runtime publish only warns when agent, skill, command or hooks.json files change under an unchanged plugin.json version, so a text fix never
- [2026-11-11 18:56] (landed) 01179ca publish:runtime refuses, current unmoved, while agent/skill/command/hook-wiring text differs from the plugin cache under
- [2026-11-11 18:59] (status) todo → review
