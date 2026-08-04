---
id: KIT-T178
title: Silent subagents show what they're doing — compile-aware progress surfaced live
type: feature
status: doing
priority: high
milestone:
labels: [hooks, dispatch, visibility]
links: [KIT-T176, KIT-T177]
files: [hooks/]
supersedes:
superseded_by:
created: 2026-08-04T21:55:00Z
updated: 2026-08-04T21:55:00Z
---

## Description

Third occurrence in one day (Chris, stiletto: "no buffer output… 230K over 30 minutes
— what the fuck" · "HUD pass 30 fucking minutes. 300K tokens" · "NO output"). Long
cargo calls inside a subagent stream nothing; the maintainer watches an expensive
black box. Every time the answer was "it's compiling" — provable only by ad-hoc
tasklist/rustc forensics from the main thread.

Make the evidence structural: hooks already fire inside subagent sessions, so a
PostToolUse/PreToolUse pair on Bash commands matching `^cargo (build|check|test|
clippy)` (extensible per-ecosystem) appends a one-line status — agent id, command,
started-at — to a per-repo progress file (e.g. `.ai/agents-progress.jsonl`); the
matching completion clears it. Consumers: orient's in-flight listing, the statusline,
and the orchestrator's health checks (replaces tasklist forensics). Stop/SubagentStop
sweeps stale lines.

## Acceptance Criteria
- [x] A subagent's long-running build/test command is visible from outside within seconds of starting (file-based, no polling of transcripts)
- [x] Cleared on command completion AND swept on agent termination — no stale "compiling" lines
- [x] Verify hook events actually fire in subagent sessions for Bash; document any dispatch shape where they don't (the KIT-T177 lesson: never assume event coverage)
- [x] Fail-open everywhere; zero effect on repos without .ai
- [x] Orient's in-flight agent listing shows the current command + elapsed for any agent with a live line

## Notes

**Event coverage — MEASURED, not assumed (the KIT-T177 lesson).** The ticket's premise
("hooks already fire inside subagent sessions") was treated as a hypothesis and tested from
inside a live delegated subagent on Windows, 2026-08-04:

1. **`PreToolUse(Bash)` fires** — `query-gate` blocked a grep the subagent itself issued, and
   the block message named the plugin path (`${CLAUDE_PLUGIN_ROOT}`), so the plugin wiring is
   the live one. A sweep of 258 transcripts from the last 7 days found 41 further
   `PreToolUse:Bash` events on sidechain (subagent) turns.
2. **`PostToolUse` fires** — proven by DISK side effect, not by output: a `.h` file written by
   the subagent made `lint.mjs` append a row naming that exact file to
   `~/.claude/maintenance-gaps.log`.
3. **`PostToolUse(Bash)` specifically fires** — `git-pull-hydrate` is registered on that
   matcher and nothing else; after a subagent Bash call matching its pattern, the SQLite cache
   was rehydrated 3s later (mtime 18:54:49 → 18:59:37).
4. **A subagent does NOT see its own PostToolUse hook output.** The gap-log row proves the hook
   ran while no stderr reached the agent. That is why the same transcript sweep shows ZERO
   sidechain `PostToolUse` events — transcripts record only hook feedback that surfaced, so
   absence there is not absence of execution. **This is the finding that shaped the design:**
   inside a subagent, a hook that emits a message emits it into the void; only a FILE is
   readable from outside. Had this been assumed rather than measured, an output-based design
   would have shipped and silently done nothing.

**The roster join.** A subagent's Bash payload carries no agent handle, but its transcript is
`…/subagents/agent-<AGENT_ID>.jsonl`, and that AGENT_ID is byte-identical to the roster's
`agent_id` — verified 29/30 overlap between stiletto's live `.ai/agents.jsonl` ids and its
sidechain transcript filenames. `progressKey` derives the key from that path, so a progress
line and its roster row join without the harness having to volunteer anything.

**Design.** `hooks/progress-store.mjs` (the store + matcher, new file — `hooks/lib.mjs` is over
the file-length gate and hard-blocks every edit, per KIT-T112/KIT-T177) and `hooks/progress.mjs`
(the hook). Append-only JSONL collapsed on read, the roster's shape and for the roster's reason:
concurrent writers can't corrupt each other, one malformed line can't poison the file. The
matcher is a per-ecosystem table (`ECOSYSTEMS`), so npm/gradle/bazel is one row later; v1 is
cargo only. The file is **gitignored** (repo `.gitignore` + `LOCAL_GITIGNORE` for new adopters):
it is second-by-second machine state, and a committed "running" line from another machine is a
lie, not history.

**Orient now shows** `[in-flight] <id> (scope) — <task> — running: cargo test (6m)`, plus
`[running] <key> — cargo build (31m) in <repo> (no dispatch row yet)` for a build whose
delegation row hasn't landed. That second line is not an edge case: `PostToolUse(Task)` fires
when the tool RESULT lands (KIT-T177), so a synchronous agent is mid-build for its entire life
before its dispatch row exists — dropping those would hide exactly the case the ticket was
raised for. An agent that is demonstrably compiling is also no longer flagged `UNCOLLECTED`;
that false alarm was the forensic noise being replaced.

**Residuals (documented, not papered over).**
1. `Stop`/`SubagentStop` delivery is not guaranteed for every dispatch shape (KIT-T177 found
   roster rows that never got a terminal event). Covered by a third clearing path: a 2h
   staleness window in the reader, so a dead session's line ages out rather than lying forever.
2. The matcher judges the command as WRITTEN — `cd x && cargo test` is not matched. Deliberate:
   the gate is a cheap prefix test and a false negative costs a missing line, never a blocked
   call.
3. Progress lines are written to the DISPATCHING session's `gitRoot()`, inheriting the roster's
   cross-repo blind spot (KIT-T177 residual 4): a session in repo B cannot see a build an agent
   is running there on behalf of repo A. Out of scope here, same as there.
4. `PowerShell` shares the matcher registration but the ecosystem regexes are POSIX-shell
   shaped; a PowerShell-invoked cargo with different quoting may not match. Not exercised.

Test artifact: `hooks/progress.test.mjs`, 42 cases — matcher per ecosystem, key derivation,
append/clear/sweep lifecycle through spawned hooks, orient rendering (all three shapes),
malformed-file and malformed-payload fail-open, unadopted-repo no-op, staleness ageing. Full kit
suite green (`npm test` exit 0; 331 hook-style assertions + 29 server tests).

## History
- [2026-08-04 21:55] (created) Chris, 3rd silent-agent complaint today — visibility becomes structural, not forensic
- [2026-08-04 21:55] (status) todo → doing — dispatching
- [2026-08-04 19:12] (comment) ticked: A subagent's long-running build/test command is visible from outside within seconds of starting (file-based, no polling of transcripts)
- [2026-08-04 19:12] (comment) ticked: Verify hook events actually fire in subagent sessions for Bash; document any dispatch shape where they don't (the KIT-T177 lesson: never assume event coverage)
- [2026-08-04 19:12] (comment) ticked: Orient's in-flight agent listing shows the current command + elapsed for any agent with a live line
- [2026-08-04 19:12] (comment) ticked: Cleared on command completion AND swept on agent termination — no stale "compiling" lines
- [2026-08-04 19:12] (comment) ticked: Fail-open everywhere; zero effect on repos without .ai
