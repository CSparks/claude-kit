---
name: work
description: Pick up one named claude-kit ticket, restate its acceptance criteria, confirm scope, implement it, and stop at review. Use when the user asks to work, implement, or resume a specific ticket ID.
---

# Work a named ticket

Read `../../commands/work.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. Use Codex plans for a live execution projection where the command refers to
Claude-native tasks. Invoke related workflows as `$skill-name` rather than `/command`, and
resolve `<kit>` from this skill's plugin root.
