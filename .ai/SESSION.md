# SESSION HANDOFF — claude-kit

Updated: 2026-08-06 (early hours) | Branch: main @ origin (fd361d0+) | Active: none — inbox empty

## Current state — inbox drained to zero; 6 bug fixes landed, all test-backed
Six fixes, one commit each, every one with a regression test. `npm test` exit 0 before and
after: **1139 → 1206 passing, 0 failing** (+67 assertions).

- **fab8749 KIT-T183** (supersedes KIT-T109) — `q next-id <scope> <store>` resolved the store
  leniently and defaulted to `tickets`, so `next-id ST decision` served the TICKET counter as
  `ST-decision128`, a bare `next-id ST` gave `ST-undefined128`, no args gave a raw SQLite
  binding error, and the markdown-scan path answered a scope it had never opened with
  `ST-D001` (the "returns 1 for decisions" report). Strict `resolveStore`/`requireStore`/
  `requireScope` in q-model, aliases derived from STORE_TYPE (plural/singular/letter);
  `formatId` delegates to `id-utils.formatItemId` so the letter mapping has ONE home; the scan
  path refuses a scope it cannot see and names `--root`.
- **eb84191 KIT-T184** — new `scripts/cli-help.mjs`: `cap --help` used to WRITE an inbox item
  titled "--help"; t/rem answered "unknown subcommand"; code-graph dumped the graph. Flag
  counts anywhere for structured CLIs, first-position only for cap (free text may contain a
  flag). New scripts/cli-help.test.mjs (16) wired into npm test.
- **319b917 KIT-T185** — `t new decision` minted a TICKET id; scaffoldNew now validates against
  `ticketTypes` (the board-routed subset the web endpoint always used) and names the route.
- **5da23d0 KIT-T186** — cap's cross-project warning now precedes the write, the receipt
  carries `[also names <project>]`, and the no-repo error lists registered projects with keys.
  Routing UNCHANGED (KIT-T067 chose propose-don't-route) — refuse-vs-warn asked in **KIT-Q001**.
- **3e58707 KIT-T190** — `t status --fixed-commit` was read only inside the done+bug branch, so
  a `review` transition (every uat=required close) dropped the sha. Always written now.
- **775a778 KIT-T191** — game-asset-artist pinned `model: fable`; now opus. dispatch-guard's
  test sweeps agents/*.md: every agent pins a model, none pins fable.

## Triage (fd361d0) — 22 captures promoted, `.ai/inbox/` holds only README + triaged/
- Backlog created: **KIT-T187/T188/T189** (plan-of-record retrieval + the out-of-repo
  capture ratchet — the feature halves of the 2026-08-06-0109 root cause), **T192..T197**
  (CRLF splicing, live-cache test isolation, supersede asymmetry, registry hygiene,
  request-gate cross-repo blindness, dispatch cost ceiling), **T198..T204** (contract
  portability, binaries/LFS wiring, init-project migration, standing conditions, hook-author
  and bevy-render-fixer agents). Each carries its capture verbatim + provenance path.
- **KIT-T181** (bootstrap PATH) got the design it never had — including why `setx` must not be
  used (1024-char truncation + the merged machine+user read) and the POSIX rc-file problem.
  Left as a FEATURE deliberately: it is a platform-specific installer change, not a small fix.
- Recorded: **KIT-D058** (binaries/LFS committed only when asked — Chris verbatim),
  **KIT-N002/N003/N004** (three process failures whose antidote is already in the contract).
- Two captures contradicted their own diagnosis, said so in the ticket: the fable pin was
  PRESENT (not missing), and the model-tag ask already shipped as KIT-T179 (commented, not
  re-ticketed).

## Next 3 steps
1. **KIT-Q001** needs Chris: should cap REFUSE an ambiguous cross-project capture, or keep
   warning? Batch it into the next `/decide`.
2. Six bug tickets sit in review awaiting acceptance (T183/T184/T185/T186/T190/T191); the
   cheap next bugs are T192 (CRLF splice) and T193 (suites touching the live cache).
3. KIT-T188 is the cheap half of the retrieval gap (orient names cited plan docs — no new
   index); T187 needs its doc-set rule decided before any code.

## UAT offered
- `q next-id KIT decision` → `KIT-D059` (was the ticket counter); `q next-id KIT` → a usage
  refusal, not `KIT-undefined183`.
- `cap --help` → usage, and `.ai/inbox/` stays clean. Same for `t --help`, `rem --help`,
  `code-graph --help`.
- `t new decision "x"` → refused, and it names where a decision belongs.
- `cap bug "something about claude-kit"` from another repo → the warning comes FIRST and the
  receipt says `[also names claude-kit]`.
- `.ai/tickets/INDEX.md` — 96 active; `.ai/inbox/` — empty but for README + triaged/.
