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
  LAST, capture-on-use distillation mandatory; KB may be indexed into the kit's
  DB read-cache (KIT-D044 pattern) if that makes lookups measurably faster.
  Contract rule LANDED in user-config/CLAUDE.global.md (DEVELOPMENT PRINCIPLES).

Remaining for triage (ticket these):
1. **KB consolidation**: resolve `research/README.md` (rules + EMPTY index) vs
   `docs/research/` (4 real docs, no README) — two homes for one knowledgebase.
   Skill doc names `docs/research/` canonical; merge README+index there. Decide
   the doc shape for library-reference docs (API surface + version) vs the
   investigation shape the README prescribes.
2. **Usage ledger hook**: portable Node hook on `mcp__*context7*` — append
   library/query/date to a usage ledger; warn (fail-open, never block) when the
   KB index already covers the topic. Spend visibility against the 1,000/mo cap.
3. **DB-cache indexing** (per KIT-D055 rider): index docs/research/ into the kit
   DB read-cache if measurably faster than reading the markdown index.

Non-proprietary boundary applies: distilled library docs are fine for MIT;
anything product-specific stays in the project's private docs.
