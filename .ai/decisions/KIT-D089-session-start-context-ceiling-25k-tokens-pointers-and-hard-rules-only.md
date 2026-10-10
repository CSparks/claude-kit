---
id: KIT-D089
title: Session-start context ceiling 25k tokens: pointers and hard rules only, reviewed weekly by an agent
status: accepted
date: 2026-10-10
supersedes:
source: KIT-T420; Chris 2026-10-10 (dirt-empire session)
---

**Decision:**
- A new session carries at most 25k tokens of ceremonial (session-start) context. `scripts/context-budget.mjs` measures every SessionStart injection per registered project (global and project CLAUDE.md, memory index, kit skill and agent listings, and the output of each SessionStart hook: orient, housekeeping), prints a table and a total, warns over 20k and fails over 25k (exit 1).
- Ceremonial context holds pointers and hard rules only. Everything else lives in the docs tree and is pulled on demand (q, code-graph, doc-trail, skills). For each oversize item the script names the docs/ home its content moves to, leaving a one-line pointer.
- Orient prints its own cost on one line (`context: orient N + files M = T tokens of 25000 ceiling`), `!!`-prefixed over the warn line.
- The weekly review runs as an agent. When due (7 days since `--record`), housekeeping emits a DISPATCH NOW directive: a sonnet agent, `[job: wiring]`, runs the script, files a ticket per oversize item naming its docs/ home, applies the safe trims (SESSION.md back to one screen, orient sections cut), and raises only an exception: an injection that cannot get under 25k.

**Why:** Chris 2026-10-10: "weekly we need to be looking at what our stand-up context size looks like. We should never be spinning up new sessions with more than 25k of ceremonial context." "That's where the documentation tree fills in the gaps." "Also, smaller contexts produce better results. Better adherence as well." On automation: "and that process should run automatically with an agent unless the agent sees something that needs to be raised to my attention."

Measured at filing (dirt-empire, 2026-10-10): global CLAUDE.md ~5.5k, project CLAUDE.md ~3.1k, orient ~3.9k, SESSION.md ~5.6k (the contract says one screen), memory index; ~18k kit-controllable before harness tool schemas.
