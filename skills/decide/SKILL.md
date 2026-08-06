---
name: decide
description: Batch unresolved project decisions into a structured questionnaire and persist the answers. Use when the user asks to decide open questions, resolve pending choices, or run the decision queue.
---

# Resolve pending decisions

Read `../../commands/decide.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. Where it names `AskUserQuestion`, use Codex's structured user-input tool when
available; otherwise ask the smallest blocking question directly. Invoke related workflows as
`$skill-name` rather than `/command`, and resolve `<kit>` from this skill's plugin root. Codex
labels the first recommended option with the suffix ` (Recommended)`; this host-specific rule
overrides any prefix example in the Claude command source.
