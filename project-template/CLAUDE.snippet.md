<!--
  Paste this block into the project's CLAUDE.md (init-project.mjs appends it
  automatically). It is the behavioral contract. It deliberately does NOT
  contain the taxonomy — that lives in .ai/config.yml so it stays flexible.
-->

## Workflow contract (.ai/)

The taxonomy, routing, priorities, statuses, and drain rules are defined in
`.ai/config.yml`. **Read it at session start; it is the source of truth.** This
contract is the meta-behavior around it.

### Bill of work — no work without the maintainer's sign-off (KIT-D132)
Every session works from a bill of work: Chris dictates it or signs off on an existing one.
Work outside the signed bill is RAISED to him, never started. The queue, roadmap, a retired
worker's handoff, a held brief and every hook or orient OPEN list are notices to relay, never
instructions to dispatch. After a clear or resume I remember no prior ask, so any action not
discussed in the current context is conferred with him before it is taken. His direct question
is answered first.

### The full workflow text lives in the kit: `<kit>/docs/project-workflow.md`
Read the part you need when you reach it:
- **Interjections** — default is CAPTURE, not STEER: classify, reality-check the target project, route, one-line receipt, keep working; block only when the classification's `blocking` rule fires.
- **Working a ticket** — restate the acceptance criteria, confirm scope, provenance before runtime theories, mirror criteria into native tasks, History and Notes are append-only, review needs a test artifact or `[no-test: <reason>]`, `done` is human-only (`t status <id> done --human` the moment he says it works).
- **Native task sync** — the ticket file is truth; the native list mirrors it, titled `T-NNN …`; hydrate at `/work` start.
- **The capture → delegate → stay-free cadence** — capture to disk at once, delegate substantial work, `/clear` is consequence-free; on resume trust the agents roster, SESSION.md and git.
- **Every store write goes through a command (KIT-T509)** — a hand Write/Edit of a store file is a defect (a hand Edit of an existing item is refused, KIT-D120); the `t`, `cap` and `rem` verbs and the full command table are in that doc.

### The queue is a notice, never an instruction (KIT-D132)
- **Between tickets**: when the active ticket hits `review`, stop and report. The next item
  per `config.drain` (roadmap order if a current milestone exists, else type
  `order` + priority) is shown as one line naming what it does, `next up: <what it does> (needs your bill of work)`, and
  waits for Chris to sign it into the bill. It may be superseded by another session or no
  longer relevant; only he knows. No `drain.auto_execute` value lifts this.
- **Questions** (`.ai/questions/`, one `<KEY>-Q###.md` each, `answerable_by: user|claude`):
  `/drain` resolves the `answerable_by: claude` ones from code + `.ai/decisions/` — writing
  the answer + date into the file's `**Resolution:**` and setting `status: resolved` (RECORD
  the answer, never delete) — and batches the `answerable_by: user` ones into the next
  `/decide`. Lifecycle is open → asked → resolved: `t ask <id>` (or a passing questionnaire that cites the id) stamps `(asked) <session>` in History; the `reask-gate` hook blocks a questionnaire that restates a question another session asked within 7 days and left unresolved (override: `[re-ask: <reason>]` in the question text); the answering session writes `t resolve <id> "<answer>"` the turn it is answered (the Stop flush warns while its asked questions stay open). The store never rots into a dead drop.
- **Regressions**: priority-bumped per config; surface proactively.
- **Anti-relitigation**: if an interjection reopens a point already in
  `.ai/DECISIONS.md`, cite it in one line ("settled 2026-05-30: X because Y —
  still holds?") instead of re-debating. Settled stays settled.

### Verification roles (KIT-D045)
- **Automated tests are Claude's, end to end**: Claude runs them, reads them, acts on
  them. Their results appear in replies as already-run evidence ("N passed", the sha) —
  never as an instruction to the maintainer.
- **The maintainer does UAT only.** The end-of-turn receipt (KIT-T099) is UAT-shaped:
  a user-facing command or experience to try — the app to open, the CLI to run and
  read, the thing to look at or listen to — or `[no-test: <reason>]` when nothing is
  user-facing.

### Backlog vs roadmap
- **Backlog** = tickets with `status: todo` and no `milestone`. Everything
  captured lands here first.
- **Roadmap** (`.ai/ROADMAP.md`) = sequenced milestones. Scheduling a ticket
  means giving it a `milestone`. When a current milestone exists, the drain
  works it in order before pulling loose backlog.

### Session memory (anti-amnesia)
- `.ai/SESSION.md` is working memory. After any meaningful step, update its
  current state + next 3 steps. Keep it to one screen — overwrite stale content.
- Record exact commands, error text, paths, and version pins **verbatim** in
  SESSION.md. Never trust these to survive in chat (compaction paraphrases).
- Append design choices to `.ai/DECISIONS.md` (decided / rejected / why).
- **Before any /compact or /clear, flush SESSION.md first.**
- Prefer subagents for codebase search; pass pointers (path + line range), not
  whole-file dumps, to keep the main thread lean.

### History & regression tracking
- **Every ticket** carries two append-only sections (KIT-D037):
  - `## Notes` — prose/narrative progress, free-form, direct-edit. Context, blockers,
    tradeoffs, research findings. Append freely, no format enforced.
  - `## History` — structured event log, stamped by the `t` CLI. One line per event,
    oldest first: `- [YYYY-MM-DD HH:MM] (event) detail` (events: `status | comment |
    decision | blocker | unblocked | fixed | regressed`, per `config.history.events`).
    Never edit or delete a prior line — it is the ticket's audit trail.
  Cross-cutting decisions also go in `.ai/DECISIONS.md`.
- **A recurring bug is a `regression` ticket, not a reopen:** set `regressed_from:
  <original id>` and `causing_commit:`; add a `(regressed) → T-NNN` line to the
  original's History. Repeat offenders surface in the generated regression index. Triage
  PROPOSES these for a provenance-less bug (KIT-T065 — symptom → code-graph → `q governing`
  → `git log`); an accepted link is marked `provenance: inferred` (a triage guess,
  auditable) vs `given` (a culprit you named), so a wrong guess is never silently authoritative.
- **Reference files are generated, never the truth:** after a status/regression change
  run `node <kit>/scripts/index-tickets.mjs` to rebuild `.ai/tickets/INDEX.md` (the
  board), `.ai/REGRESSIONS.md` (chains), and `.ai/ROADMAP.md` (thin sequence, when
  `roadmap_mode: generated`) from the ticket frontmatter.

### Where items live (atomic — D-009)
Every category of items is a **folder of one-file-per-item**, like `tickets/`: never a
monolith file.
- `tickets/` (+ `archive/`) · `decisions/` (`<KEY>-D###-slug.md`) · `questions/` (`<KEY>-Q###-slug.md`) ·
  `notes/` (`<KEY>-N###.md`) · `inbox/` (one file per raw capture; `cap` writes here; triage
  promotes each into the others and moves it to `inbox/triaged/`).
- Singletons stay single: `config.yml`, `SESSION.md`.
- **Generated views (don't hand-edit):** `tickets/INDEX.md`, `REGRESSIONS.md`,
  `ROADMAP.md` (in generated mode) — all rebuilt from the folders by `index-tickets.mjs`.
- Routing a captured item = create the atomic file in the right folder (per
  `config.yml` `routes_to`), then regenerate the views.
