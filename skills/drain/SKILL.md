---
name: drain
description: List the next ready claude-kit backlog items according to .ai/config.yml as candidates for the maintainer's bill of work; starts nothing without his sign-off. Use when the user asks what is next, or asks to drain the queue, keep going, or work the backlog without naming a ticket.
---

# Drain the work queue

Read `../../commands/drain.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. Invoke related workflows as `$skill-name` rather than `/command`. Resolve `<kit>`
from this skill's plugin root; `PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT` both identify that root
inside plugin hooks.
