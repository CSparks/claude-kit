---
id: KIT-T1357
title: claims-release gate miss: a subagent piping a synthetic PostToolUse(TaskStop) payload into compat-run.mjs agent-roster.mjs releases another
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T00:22:39Z
updated: 2026-11-18T00:29:33Z
---

## Description
claims-release gate miss: a subagent piping a synthetic PostToolUse(TaskStop) payload into compat-run.mjs agent-roster.mjs releases another agent's file claims (recordKill calls releaseAgent), bypassing KIT-T1287's main-thread-only rule; seen during KIT-T1356 diagnosis, which released a6eb8222d80efa278's claim in the real holders registry

kit-bug-shape: cap:bug:claims-release-gate-miss-a-subagent-piping-a-syn:da4200c3
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A subagent's Bash or PowerShell command that runs a kit hook entry point (every script hooks.json launches, plus compat-run.mjs and compat-core.mjs) is refused by claims-release-gate under check-id hook-entry-run: a pipe into it, a redirect, an env prefix, backslash or escaped paths, bash -c, builds --run, node -e import, node --import, the hook run as the command (hooks/hook-entry-run.test.mjs)
- [x] Test files, git and read commands naming a hook path, print-only commands, a node CLI given a hook path as an argument, scripts/code-graph.mjs (shares a hook's file name), and the main thread pass

## Plan
1.

## Notes
Fix: hooks/lib/hook-entries.mjs derives the entry names from hooks.json (SCRIPT_IN_COMMAND now lives there, gate-wiring imports it) and judges a command from its shell segments: node/bun/deno whose script (first non-flag argument), -e code or --import module is a hooks/<entry> path or a bare entry name, an entry run as the command, or a quoted body doing either; claims-release-gate refuses it for a subagent (check-id hook-entry-run). printsOnly is shared from claims-release-match.mjs. Residual, by design: a subagent can still write a script or test file that spawns a hook with a made-up payload; the gate judges commands, not file contents. Tests: hooks/hook-entry-run.test.mjs all pass; claims-release-verb all pass; gate-wiring 17 passed.

## History
- [2026-11-18 00:22] (created) bug — claims-release gate miss: a subagent piping a synthetic PostToolUse(TaskStop) payload into compat-run.mjs agent-roster.mjs releases another
- [2026-11-18 00:29] (status) todo → doing
- [2026-11-18 00:29] (comment) criterion added: A subagent's Bash or PowerShell command that runs a kit hook entry point (every script hooks.json launches, plus compat-run.mjs and compat-core.mjs) is refused by claims-release-gate under check-id hook-entry-run: a pipe into it, a redirect, an env prefix, backslash or escaped paths, bash -c, builds --run, node -e import, node --import, the hook run as the command (hooks/hook-entry-run.test.mjs)
- [2026-11-18 00:29] (comment) criterion added: Test files, git and read commands naming a hook path, print-only commands, a node CLI given a hook path as an argument, scripts/code-graph.mjs (shares a hook's file name), and the main thread pass
- [2026-11-18 00:29] (comment) ticked: hooks/hook-entry-run.test.mjs all pass (27 ok)
- [2026-11-18 00:29] (comment) ticked: Test files, git and read commands naming a hook path, print-only commands, a node CLI given a hook path as an argument, scripts/code-graph.mjs (shares a hook's file name), and the main thread pass
