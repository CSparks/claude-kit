# Process failure: agent dispatched onto a PARKED build's suite — no governing-decision check in the drain

2026-08-08, gridiron-blitz. GB-T103 ("legacy2d suite not green on main") was
self-captured and immediately drain-dispatched to an opus agent. GB-D009 had
parked the 2D build; Chris had to interrupt ("IT'S FUCKING LEGACY") — now
GB-D018. Root cause: the drain pull and dispatch flow never queried the
governing decisions for the ticket's AREA (q.mjs `governing`/`trail` exist and
were not consulted); a red suite pattern-matched to "suite-health, urgent"
regardless of WHOSE suite. Aggravator: stale convention — prior receipts kept
citing legacy2d counts long after GB-D009, so the parked status was invisible in
recent habit. Enforcement idea: before `status → doing` on a self-captured
ticket, require a `q governing <files>` pass in the dispatch checklist (hookable:
block dispatch receipts lacking it); and when a decision parks an area, the
capture flow should tag the area so triage flags any new ticket touching it.
