---
id: KIT-D119
title: Unclear shell quoting fails closed in every deny gate; agents rewrite the command
summary: A command line with an escaped quote, a $'…'/$"…" string or an unclosed quote is blocked by any gate whose trigger word appears anywhere in it; no exemption for git commit -m
date: 2026-10-29
supersedes: 
source: conversation 2026-10-29 (AskUserQuestion)
---


**Decision:** When `segments()` flags a command as ambiguous (an escaped quote, a `$'…'`/`$"…"` string, or an unclosed quote), each deny gate blocks if its own trigger words appear anywhere in the raw text. The block message says to rewrite with single quotes, or put the text in a file (`git commit -F`, a scratchpad script). There is no carve-out for `git commit -m`. Chris chose "Keep strict" over "Loosen for git commit" and "Warn, don't block".

**Why:** KIT-D117. A carve-out means parsing where a quoted argument ends, and every such parser shipped on 2026-10-29 drew a security-review bypass (KIT-T701, KIT-T705, KIT-T706). The friction falls on agents, and they can rewrite.
