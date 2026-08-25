# inbox/ — raw capture

One file per captured idea (atomic — D-009), fire-and-forget. `cap` writes them here;
**triage** promotes each into `tickets/` / `decisions/` / `questions/` / `notes/` and
then moves the inbox file to `inbox/triaged/` (never deleted — provenance is preserved).
Nothing durable lives here — it's the intake buffer that drains.

Filename: `YYYY-MM-DD-HHMM-<slug>.md`. Body is freeform; an optional `(type)` on the
first line hints the classification:

```
(bug) SSO login loops after token refresh
repro: sign in, let the token expire, click anything → redirect loop
```

This folder is never an index — the board/roadmap are generated from the durable
folders by `scripts/index-tickets.mjs`.

## Identity fields (KIT-T189)

A capture may carry two trailing `key: value` lines, after the body and separated by a blank
line — the same shape `cap --done` writes `resolved:` in, so the FIRST line stays the item's
title for every reader:

```
(decision) the V100 lane is the daily driver

topic: llm-rig
session: 8df0fda7-13d9-4477-a0b2-035005e8bb80
```

* `topic` — the thread this item belongs to. A slug, set explicitly with `cap topic <slug>`
  and stamped on every later capture in that session. It is what `q topics` and
  `q --topic <slug>` group by; nothing on disk is grouped by topic.
* `session` — the Claude Code session that produced the item, so a fact can be traced back to
  the conversation it came out of.

Both are optional. Both spellings are read — a durable item may carry `topic:`/`session:` in
its **frontmatter** instead, and frontmatter wins when both are present. Triage carries the
whole capture into the promoted item's body, so a promoted item keeps its identity and stays
reachable by `q --topic`.
