# SESSION HANDOFF — claude-kit

Updated: 2026-07-25 | Branch: main @ origin (278b75a) | Active: KIT-T153 in review

## Current state
- **KIT-T153 REVIEW (db6ebcc + 278b75a, pushed)** — the web UI/API can now tick,
  untick and add acceptance criteria and create tickets. Chris's ask: he could not
  check off GG-T089's EIN / bank-account criteria himself.
  - New `scripts/criteria.mjs` (the criteria concern, pure body→body transforms) +
    `scripts/md-body.mjs` (stamp / appendUnderSection / sectionRange) — extracted
    rather than grown into t.mjs, which was 559 lines against the 600 block.
  - `t untick <id> <sel>`, `t criterion <id> "<text>"`, `t new … --priority`.
  - API: `POST /tickets`, `POST /tickets/:id/criteria`,
    `POST /tickets/:id/criteria/:index/{tick,untick}`.
  - `ticket-parse.parseAcceptance` DELEGATES to `criteria.listCriteria`, so a
    rendered criterion `index` IS the index a write addresses. DTO exposes it.
  - Project rows carry `types` (board-bound classifications only) + `priorities`
    from each store's own config.yml — no client-side copy of the taxonomy.
  - Evidence: `npm test` exit 0 — 739 assertions / 25 suites + 39 node:test cases;
    t 73, server 29; `tsc -b` + vite build clean.
  - Fixed on the way: `tick()` used to scan the WHOLE body, so a `- [ ]` under Plan
    or Notes was tickable. Criteria are section-scoped now.
- **GG-T089** (groovegrid, data repo c18ac03): EIN + Mercury bank account criteria
  ticked for Chris — 7/8. Only the single-member company agreement is open.

## Landmines found today (logged, not fixed)
- **KIT-T142 (comment #1): `npm test` CORRUPTS the live cache.** `t.test.mjs`
  fixtures declare `ids.key: "KIT"`, so the CLI-integration test hydrates a temp
  fixture root into the real `.cache/workflow.db` under the REAL scope — it
  REPLACES the live KIT rows (measured: openCount 56→1, staleness check blind to
  it). Repair: `node scripts/hydrate-db.mjs`. Fix needs both halves — isolated temp
  dbPath in tests (as server.test.mjs already does) AND non-colliding fixture keys.
- **A stale `node server/index.mjs` from 2026-07-24 20:23 still holds :4319** and
  serves pre-T153 code. Any live check must use a spare port
  (`KIT_SERVER_PORT=4400`) or Chris restarts it.
- Untriaged inbox cap, now more urgent: API markdown writes are never
  git-committed (`inbox/2026-07-23-2043-api-markdown-writes…`). The more the
  browser can write, the more that machine-local gap bites.

## Next 3 steps
1. Chris UATs KIT-T153 in the browser (restart the server first), then `/done`.
2. Triage the inbox — 7 caps, the API-auto-commit one first.
3. Drain: KIT-T142 (cache clobber, high) then KIT-T150 / KIT-T143.

## Carry-over
- 72 tickets in review awaiting Chris's `/done`; oldest 44d.
- Zombie `doing`: GG-T097 (GG-T089 reconciled today — legitimately in flight,
  waiting on the company agreement).
- Memory + maintenance weekly reviews are due (session-start nag, 20 gaps in this
  project's maintenance-gaps.log).
- KIT-T099 open AC: re-run bootstrap on Chris's machines.
