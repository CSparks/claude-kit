---
id: KIT-D124
title: Quoted heredoc bodies and quoted arguments are inert data; ambiguous quoting is judged by command position
summary: Refines KIT-D119 - a quoted-delimiter heredoc read by a data consumer is cut before parsing, and query-gate judges an ambiguous line by each piece's command word, not by search words anywhere
date: 2026-11-01
supersedes: 
source: kit agent, tickets KIT-T784, KIT-T785, KIT-T711 (false positives seen 2026-11-01)
---


**Decision:** (1) `inertText()` (hooks/lib/inert-heredoc.mjs) removes the body of a `<<'WORD'` / `<<"WORD"` heredoc before any gate parses the line, only when the reader is a data consumer (git, gh, cat, tee, t, cap, rem, q, wc, sort, jq, or node/python running a script file), the line does not pipe the reader on, the opener is not in a comment or behind a backslash, a terminator line exists, and the remaining text is unambiguous. A shell, `node -`, `ssh` or an unquoted delimiter keeps its body parsed. (2) query-gate judges an ambiguous line by the command word at the start of each operator-blind piece (`commandLeads`), so a search word inside a quoted argument is data while a command hidden behind an escaped quote still leads its own piece. (3) broker-wait-gate treats a `for` loop as a poll only around a broker call; sleep, tail -f, Get-Content -Wait and while/until loops (except `while read`) stay polls around a broker call or target/broker.

**Why:** KIT-D119 keeps strictness for the shapes that hide a command. A quoted heredoc body and a quoted argument hide none: the shell never runs them, so blocking on their words blocked heredoc commit messages, `node -e` edits and `t comment` text with no safety gain. Store-shell-gate keeps its raw write-token scan for ambiguous lines; only the heredoc cut relaxes it. D119's "no carve-out for `git commit -m`" still holds: an inline `-m` string with an escaped quote is judged as before.
