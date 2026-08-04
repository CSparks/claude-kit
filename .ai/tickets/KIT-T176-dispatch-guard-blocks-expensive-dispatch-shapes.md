---
id: KIT-T176
title: dispatch-guard blocks the two dispatch shapes that have burned real money
type: feature
status: review
priority: high
milestone:
labels: [hooks, dispatch, cost]
links: [KIT-T082, KIT-T151]
files: [hooks/dispatch-guard.mjs]
supersedes:
superseded_by:
created: 2026-08-04T20:25:00Z
updated: 2026-08-04T18:19:01Z
fixed_commit: ecc7753
---

## Description

Chris, verbatim (2026-08-04, stiletto): "That's the second fucking time that's happened
and it needs to fucking stop at a system level via Claude Kit so the knowledge is
portable." The two lived incidents, both prose-rule-only until now:

1. **2026-08-03 — two agents in one working tree**: one billed agent waited out a
   colleague's broken refactor and built a throwaway scratch crate around it ("That has
   a bad fucking smell"). Rule lives in CLAUDE.md prose; nothing enforces it.
2. **2026-08-04 — cold-worktree compile burn**: an `isolation: worktree` dispatch into
   a Bevy workspace paid a full cold build of the dependency graph (30+ min silent,
   rustc at 3.3 GB RSS) because a fresh worktree has no `target/`. Nothing warned at
   dispatch time.

Both are decided at ONE choke point — the Agent-tool dispatch — so both become checks
in the existing PreToolUse dispatch gate (`hooks/dispatch-guard.mjs`), portable to
every adopted repo. Halts, not warnings, per the hook contract; explicit inline escape
tokens only.

## Acceptance Criteria
- [x] Check `cold-worktree-build`: Agent dispatch with `isolation: worktree` into a repo with root `Cargo.toml` BLOCKS unless the prompt provisions the build cache (mentions `CARGO_TARGET_DIR`) or carries `[cold-build-ok: <reason>]`. Message states the cold-build cost and both remedies.
- [x] Check `shared-tree-dispatch`: a new Agent dispatch WITHOUT worktree isolation, while the agents.jsonl roster shows an in-flight (uncollected) agent for the same repo, BLOCKS with the one-agent-per-tree rule; escape `[shared-tree-ok: <reason>]`. Roster read reuses agent-roster.mjs's data; stale (>2h) rows are ignored, fail-open.
- [x] Both checks fail open on any parse/read error (hook contract); both carry the standard exclusion footer (check-id + both surfaces) and honor `.claude-kit-ignore.yaml`.
- [x] Tests in `dispatch-guard.test.mjs` per the existing pattern: block, token-escape, ignore-file escape, fail-open, non-Rust repo passes, no-roster passes.
- [x] `hooks/README.md` documents both checks + tokens.

## History
- [2026-08-04 20:25] (created) Chris directive after the 2nd dispatch-cost burn — enforce at kit level, portable
- [2026-08-04 20:25] (status) todo → doing — implementing now
- [2026-08-04 18:18] (comment) ticked: Check `cold-worktree-build`: Agent dispatch with `isolation: worktree` into a repo with root `Cargo.toml` BLOCKS unless the prompt provisions the build cache (mentions `CARGO_TARGET_DIR`) or carries `[cold-build-ok: <reason>]`. Message states the cold-build cost and both remedies.
- [2026-08-04 18:18] (comment) ticked: Both checks fail open on any parse/read error (hook contract); both carry the standard exclusion footer (check-id + both surfaces) and honor `.claude-kit-ignore.yaml`.
- [2026-08-04 18:18] (comment) ticked: `hooks/README.md` documents both checks + tokens.
- [2026-08-04 18:18] (comment) ticked: Check `shared-tree-dispatch`: a new Agent dispatch WITHOUT worktree isolation, while the agents.jsonl roster shows an in-flight (uncollected) agent for the same repo, BLOCKS with the one-agent-per-tree rule; escape `[shared-tree-ok: <reason>]`. Roster read reuses agent-roster.mjs's data; stale (>2h) rows are ignored, fail-open.
- [2026-08-04 18:18] (comment) ticked: Tests in `dispatch-guard.test.mjs` per the existing pattern: block, token-escape, ignore-file escape, fail-open, non-Rust repo passes, no-roster passes.
- [2026-08-04 18:19] (comment) @claude: (fixed) ecc7753 - three independent checks in the one PreToolUse(Task|Agent) gate; dispatch-ladder untouched. Test artif (full comment #1 in ## Notes)
### comment #1 [2026-08-04 18:19] @claude
(fixed) ecc7753 - three independent checks in the one PreToolUse(Task|Agent) gate; dispatch-ladder untouched. Test artifact: hooks/dispatch-guard.test.mjs, 41 cases (14 existing unchanged + 27 new) all PASS; full kit suite green (npm test exit 0, 235 assertions).
- [2026-08-04 18:19] (status) doing → review
