# code-graph returns [] for everything in gridiron-blitz

2026-08-08 11:25, main @ e5be648. `code-graph --query importers-of
src/league/schools.rs` → `[]`, same for `importers-of src/league/mod.rs`,
`defines SCHOOLS`, `surface src/league/schools.rs` — all `[]` despite real
symbols and real importers (league/mod.rs re-exports; teamselect.rs +
exhibition.rs import). `code-graph status` errors (ENOENT scandir '<cwd>/status'
— arg parsing?). The contract routes file-finding through the graph and gates
greps on it; an empty-but-alive index silently pushes every lookup to fallback
greps, and nearly caused a wrong conclusion (a truncated grep read as "no
importers"). Needs: (a) index rebuilt/health-checked for gridiron-blitz, (b) the
graph to DISTINGUISH "no results" from "index missing/stale" — an empty answer
from a dead index should be an error, not [].
