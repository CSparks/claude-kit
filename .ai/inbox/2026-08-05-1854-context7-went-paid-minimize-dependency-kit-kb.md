# Context7 went paid — minimize dependency, make every call land in the kit KB

Context7 cut its free tier ~92% in Jan 2026 (≈6,000 → 500, bumped to 1,000 req/mo
2026-01-16); paid plan $10/mo. Verified 2026-08-05 (context7.com/plans; devgenius
"Context7 Quietly Slashed Its Free Tier by 92%"). It is installed as
`context7@claude-plugins-official` (user scope, settings.json) — NOT kit-shipped —
and its MCP server instructions push maximal use ("even well-known libraries...
use even when you think you know the answer; prefer over web search"): exactly
inverted under metered pricing.

Chris's direction (2026-08-05): minimize the dependency, or at least make calls
count and get documented; better still, a kit-native knowledgebase that evolves
with research and resources like Context7.

SETTLED same day (2026-08-05, do not re-decide at triage):
- **KIT-D054** — the plugin stays a user-scoped install; the kit never ships or
  manages it, only the KB + contract rule + any hook around it.
- **KIT-D055** — lookup order inverted: kit KB → training → web search → context7
  LAST, capture-on-use distillation mandatory. Contract rule LANDED in
  user-config/CLAUDE.global.md (DEVELOPMENT PRINCIPLES).
- **KIT-D056** — KB home is top-level `research/` (reaffirms KIT-D004; skill-doc
  drift fixed); `docs/research/` stays kit design docs; BOTH join the FTS doc
  index — the "cache it in the DB" rider is KIT-T101 scope (comment #1 there),
  not a new mechanism. Library-reference doc shape added to research/README.md.

Remaining for triage (ticket this):
1. **Usage ledger hook**: portable Node hook on `mcp__*context7*` — append
   library/query/date to a usage ledger; warn (fail-open, never block) when the
   KB index already covers the topic. Spend visibility against the 1,000/mo cap.

Non-proprietary boundary applies: distilled library docs are fine for MIT;
anything product-specific stays in the project's private docs.
