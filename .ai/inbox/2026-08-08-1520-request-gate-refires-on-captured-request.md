# request-gate re-fires on an already-captured request across turns

2026-08-08, gridiron-blitz. "Kicks SHOULD be higher arcs" was routed to GB-T119
(verbatim in the ticket, status doing) and receipted in the reply the turn it
arrived. The request-capture check fired anyway on that turn's stop, was
answered with the ticket pointer, then fired AGAIN two turns later when a later
reply merely mentioned kicks. The gate appears to scan the visible tail for
request-shaped lines without consulting the store (q fts would find the verbatim
in GB-T119 instantly) and without remembering its own acknowledged answers.
Fix idea: before warning, run the candidate line through q fts against
tickets/decisions; a hit (or a prior [no-capture]/receipt for the same line in
the session) suppresses the warning.
