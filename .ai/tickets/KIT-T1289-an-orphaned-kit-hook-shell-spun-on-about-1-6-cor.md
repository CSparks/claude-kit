---
id: KIT-T1289
title: An orphaned kit hook shell spun on about 1.6 cores for 44 hours: bash.exe -c node CLAUDE_PLUGIN_ROOT/hooks/compat-run.mjs dispatch-label.mjs
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T02:57:47Z
updated: 2026-11-16T02:57:47Z
---

## Description
An orphaned kit hook shell spun on about 1.6 cores for 44 hours: bash.exe -c node CLAUDE_PLUGIN_ROOT/hooks/compat-run.mjs dispatch-label.mjs, started 2026-11-14 00:56, parent process gone, found 2026-11-15 21:20 when the maintainer reported all cores saturated; stopped by hand. Wanted: a hook run through compat-run has a hard time limit and exits when its parent or stdin is gone, so a hook can never outlive its call; and the housekeeping reminder lists kit hook processes older than a few minutes. Also to check: the machine build budget caps cargo jobs, but a test or census executable started by an agent runs its own thread pool on every core beside the maintainer's running game.

kit-bug-shape: cap:bug:an-orphaned-kit-hook-shell-spun-on-about-1-6-cor:3a030a65
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x]

## Plan
1.

## Notes
CORRECTION: the process was NOT stopped by the agent (the attempt was denied); the maintainer ended it himself. CAUSE (read-only CIM samples, 2026-11-15 ~22:00): pid 23084 was bash.exe with NO child process and a missing parent (ppid 38272), 2 threads, CPU 247713 s over 44 h (about 1.5 cores); two samples 8 s apart gained 11.6 cpu-s. The node child of 'bash -c node compat-run.mjs dispatch-label.mjs' had already ended, so no node-side wait (stdin, spawnSync) was spinning: the spinner was the msys bash shell itself, orphaned. The existing runaway reaper (hooks/lib/runaway.mjs) only scanned descendants of Bash-tool shells (snapshot-bash), so a harness hook shell with a dead parent was invisible to it. FIX: (1) hooks/lib/stuck-hooks.mjs finds kit hook processes (command line holds compat-run.mjs) older than 5 min; runaway.mjs now treats one with a dead parent or a spinning cpu ratio as a root, so the orphan reaper ends it; (2) housekeeping SessionStart prints 'STUCK KIT HOOKS: pid .. age .. cpu ..'; (3) compat-core: every hook has a wall-clock limit (hooks/lib/hook-limits.mjs: 15 s default, 120 s for the hooks that fetch/push/lint/index, CLAUDE_KIT_HOOK_LIMIT_MS overrides), event-driven stdin read that ends on EOF, error or the limit, spawnSync timeout with SIGKILL, timeout exits 0 (fail open) with a stderr line carrying the launcher cpu time. Tests: hooks/compat-run-limit.test.mjs 14, stuck-hooks.test.mjs 7, runaway.test.mjs 22, compat-run 12, compat-launcher 9, dispatch-label 34, excluded-trees 19, housekeeping 42, orphan-reaper 19, plugin-compat 160, is-main 5, runtime-wiring 22; mutation: removing the spawnSync timeout fails 2, stretching the stdin timer fails 3.

## History
- [2026-11-16 02:57] (created) bug — An orphaned kit hook shell spun on about 1.6 cores for 44 hours: bash.exe -c node CLAUDE_PLUGIN_ROOT/hooks/compat-run.mjs dispatch-label.mjs
- [2026-11-16 03:12] (comment) ticked: 
