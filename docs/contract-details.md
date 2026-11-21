# Contract details moved out of the global file

Rules the global contract keeps as a one-line pointer. Each is in force.

## Logging extras
- **Requests** are actionable or ticketable items, not every prompt, captured the moment one is accepted. The request gate counts captures written to the kit store.
- **Dedup before you file (KIT-T025/T159):** an item created directly (not via `cap` → triage) runs `q fts` on its nouns first — duplicating a parallel session's ticket is a filing bug.
- **Lapsed tickets reopen (KIT-D107):** a ticket idle in review 14+ days with no maintainer feedback closes labelled `lapsed`. When the maintainer describes something in conversation that collides with one (`q fts`, label `lapsed`), reopen it with `t status <id> todo` (add `--remaining "…"` if it has landed commits) and a `t comment` quoting his words instead of filing new.
- **Rulings:** orient replays the kit's last three days of decisions into every project's session, so a ruling in one session reaches the rest; a directive left in a ticket comment reaches no one. The Stop hook blocks once while a ruling capture rests in the inbox and warns every Stop after; orient lists un-promoted rulings (id, age, first line) near the top; read them with `q show <id>` before you design. A note that is not a ruling clears with `t triage <id> --skip`.

## Kit bugs and features: the filing mechanics
Filing by hand: `cap bug …` / `cap feature …` with `--project claude-kit`, or `t new` in the kit checkout; search first (`q fts`). The kit files many of these itself (q gaps, hook crashes, a grep after an empty q); orient lists the open ones as OPEN notices. Follow-up work after a hand-back (KIT-T505) goes to a fresh dispatch with the prior context in the brief, or the agent reports through SendMessage; a handed-back agent never reports again unprompted. A session otherwise covers its repo plus its submodules; q searches that by default.
