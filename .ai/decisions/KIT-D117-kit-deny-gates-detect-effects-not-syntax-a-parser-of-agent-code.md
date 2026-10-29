---
id: KIT-D117
title: Kit deny-gates detect effects, not syntax; a parser of agent code never decides an allow
summary: Gates against shell or script bypasses observe what changed (git state diff, process table) and fail closed; parsing commands or scripts only adds fast early blocks and never grants a pass
date: 2026-10-29
supersedes: 
source: conversation 2026-10-29
---


**Decision:** A kit gate enforcing KIT-D113 ("use the kit tool, not your own") decides on the observed effect wherever it can: a tracked-file diff around a shell call, or the live process table. Parsing a command or script may add a fast early block, but parsing never grants an allow. That rules out masking quoted text, parsing write targets to exempt them, and parsing wrapper flags to find the "real" command. When parsing is ambiguous, the gate blocks.

**Why:** On 2026-10-29 the source-shell-write gate went through four published versions. Quote masking, a tokenizer, wrapper unwrapping and literal write-target parsing each opened a new security-review bypass (KIT-T701, KIT-T706): parser differentials, missing sinks, escapes. The raw, position-free scan held, and effect detection catches every sink, path form and wrapper without parsing anything. The rejected alternative, a per-tool table of option and sink grammars, is unbounded and always behind what agents actually write.
