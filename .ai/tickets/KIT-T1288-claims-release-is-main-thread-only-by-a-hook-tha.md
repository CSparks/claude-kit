---
id: KIT-T1288
title: claims --release is main-thread-only by a hook that matches the command text with one regex (hooks/claims-release-gate.mjs), so a subagent c
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T00:55:52Z
updated: 2026-11-16T01:07:47Z
---

## Description
claims --release is main-thread-only by a hook that matches the command text with one regex (hooks/claims-release-gate.mjs), so a subagent can reach it by quoting or another spelling: a security review finding on runtime a289b53 (KIT-T1287). Wanted: the caller check enforced inside scripts/claims.mjs itself (refuse when run from a subagent context, by whatever the kit can verify there: the session and agent state the hooks already record for the calling shell, not the command text), and the hook matching de-quoted shell tokens with the repo's shell parser, refusing any subagent command that names claims.mjs or the claims shim with a release in any form.

kit-bug-shape: cap:bug:claims-release-is-main-thread-only-by-a-hook-tha:0a65b2cb
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 5ba4f46 (runtime 5ba4f46, hooks.json unchanged so no plugin bump). Layer 1: scripts/claims.mjs releaseDead (CLI and any import) refuses unless CLAUDE_KIT_CLAIMS_STAMP holds a fresh (60 s), unspent nonce issued for the same agent id. The PreToolUse gate (hooks/claims-release-gate.mjs) issues that stamp only for a MAIN-THREAD call whose tokens read as a plain claims --release <id> (hooks/lib/claims-stamp.mjs; exported into the command the way build-wrap exports CLAUDE_KIT_BUILD_WRITER). Limit: the stamp proves the hook saw a main-thread call for that id, not who holds the nonce; the stamp file is under the user's temp dir, so a subagent that finds a live one inside its window can spend it for the same id the main thread asked to release (it cannot mint one, name another id or reuse it). Only a main-thread plain call is stamped: bash -c or builds --run by the main thread now refuses. A rewrite of the command by another hook that drops this one would also refuse (safe direction). Layer 2: hooks/lib/claims-release-match.mjs tokenizes with segments/shellTokens/unquoteSpans; a subagent command is refused when a de-quoted token names claims and a --release word appears anywhere (quoted bodies of bash -c, sh -c, eval, powershell -Command, node -e, builds --run, variables, glued or broken quotes, command substitution, a pipe into a shell), or any token names releaseDead, releaseAgent, the stamp variable or the claims-stamps folder; an unpairable command is judged word by word; a lone echo/printf/q/t/cap/rem segment without substitution passes (kept so the existing echo claims test passes and q code claims --release still works). Not guarded: checkout-holder releaseAgent itself (the SubagentStop path needs it; only the token check covers it); globs and runtime-built names reach only layer 1. Tests: hooks/claims-release-verb.test.mjs 46 checks all pass, mutation-checked (consume check removed: 8 fail; matcher disabled: 17 fail; id/ttl check removed: 4 fail); handback 51, agent-claims, claim-release, claim-release-controls, source-shell-gate-main-restore, source-shell-gate-discard-live 72, plugin-compat 160, plugin-drift 14: no FAIL.

## History
- [2026-11-16 00:55] (created) bug — claims --release is main-thread-only by a hook that matches the command text with one regex (hooks/claims-release-gate.mjs), so a subagent c
- [2026-11-16 01:07] (landed) 5ba4f46 claims --release refuses a subagent in any spelling and without a main-thread stamp (implements KIT-T1288)
- [2026-11-16 01:07] (status) todo → review
