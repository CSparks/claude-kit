---
description: Route an interjection into .ai/ without stopping current work
argument-hint: "[type] <text>"
---
Classify and route the following per the contract in CLAUDE.md and the taxonomy
in `.ai/config.yml`, WITHOUT stopping current work unless its `blocking` rule
fires. Emit a one-line receipt, then continue what you were doing.

A capture that quotes the maintainer (verbatim, a ruling, a directive, "<name> said", a quoted
sentence) is a decision, not a note (KIT-T938). `cap` prints `RULING CAPTURED: <id>`; promote it
the same turn, before other work: write a draft with a `**Maintainer:**` paragraph holding his
words verbatim, a `**Decision:**` and a `**Why:**`, then
`t decide --file <draft.md> --from <inbox id>` (records the decision and moves the note out of the
inbox). The Stop hook blocks once while a ruling captured this turn rests in the inbox and warns
every Stop after; orient lists it near the top, above the generic inbox count. A note that is not a ruling clears with
`t triage <id> --skip`.

Interjection: $ARGUMENTS
