---
name: cap
description: Capture and route an interjection into the active project's .ai store without derailing current work. Use when the user says to log, capture, remember, defer, or file an idea, bug, question, decision, or note.
---

# Capture an interjection

Read `../../commands/cap.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. In Codex, invoke related workflows as `$skill-name` rather than `/command`.
Resolve `<kit>` from this skill's plugin root; `PLUGIN_ROOT` and
`CLAUDE_PLUGIN_ROOT` both identify that root inside plugin hooks.
