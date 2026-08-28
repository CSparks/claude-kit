(bug) empty/failed store-and-ledger greps read as negative facts: a grep for the CHOICES.toml noise row matched nothing (wrong pattern for the [[choice]] schema) and Claude proceeded to relitigate the day-old fastnoise-lite row from training knowledge instead of reading the ledger. Root cause: a query that returns nothing is treated as 'checked, absent' with no receipt. Wanted: ground-before-claim enforcement for CHOICES.toml/ledger mentions — naming a crate alternative in output requires citing the row (or 'not checked'), same shape as KIT-T214 state-claim receipts.

Chris 2026-08-21, escalating (verbatim): "if you're having to grep for shit that should
be cached in a database with a full text index, that's a big fucking process failure."
Concrete fix, two parts: (1) register CHOICES.toml as an INDEXED STORE in q — row-level
FTS (concern/crate/why/rejected/decided), so `q fts fastnoise` surfaces the ledger row
itself, not just tickets that mention it; generalize to other registered non-.ai truth
files (docs/CRATES.md, research KB). (2) extend the query-gate to cover ledger paths —
a grep against CHOICES.toml gets blocked and routed to q exactly like a .ai store grep.
Note: q's existing index ALREADY surfaced ST-T325's title on `fts fastnoise` — the miss
was grepping instead of querying; gate coverage is what makes the right tool the only
tool.
