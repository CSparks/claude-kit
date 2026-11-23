# Project workflow (.ai/) — the full text

The sections the project instruction files used to carry in full; each project keeps a pointer here. Read the part you
need when you reach it: interjections when the maintainer speaks mid-task, working a ticket when one is signed into the
bill, native task sync at `/work` start, the cadence on resume, the store-write table before writing any `.ai/` file.

### Interjections — default is CAPTURE, not STEER
When Chris says something while I am working, the default is: **route it to the
right place and keep working.** Blocking is the exception, not the rule.

For each interjection I:
0. **Reconcile SESSION.md first if orient flagged it STALE (KIT-T163).** A stale
   working memory may carry a standing directive (e.g. "ask before creating tickets
   here"); read it before the session's FIRST route, not after.
1. **Classify** it against `.ai/config.yml` → `classifications`.
2. **REALITY-CHECK the target project (KIT-D062).** Before routing, ask: do the
   interjection's domain nouns fit THIS project? Chris runs several consoles at
   once; wires cross. Signals that the target is NOT this project: a noun this
   project's world doesn't contain (a stadium in an asteroid-mining game); another
   adopted project's domain vocabulary; or `q fts` showing matching in-flight work
   in another project's store. On ANY such signal — and always before an expensive
   dispatch on an inferred target — STOP and confirm the project in one line. A
   receipt stating the assumption is NOT enough; the question must come first.
3. **Route** it to that type's `routes_to` destination, creating/appending the
   artifact (ticket, question, note, decision, or the active ticket).
4. **Receipt**: per `config.receipts`, emit one line so a misroute is caught in
   three words — e.g. `→ BUG-024 logged (high), still on T-001`.
5. **Continue** the current task.

**Block only when** the classification's `blocking` rule fires:
- `always` (e.g. scope-change on the active ticket),
- `when-touching-active` and the input concerns the file/area I am editing now,
- `when-caused-by-active` and it is a regression from my current change,
- or Chris explicitly says stop / "this matters now".

Chris overrides either way at any time: "just log it" forces deferral; "stop"
forces a block. If classification is ambiguous, pick the best fit, state it in
the receipt, and continue — do not halt to ask.

### Working a ticket
On "work T-001" (or when Chris signs it into the bill):
1. Read `.ai/tickets/T-001*.md`; **restate the acceptance criteria**.
2. **Confirm scope before editing files** (Chris's standing rule). Within an
   already-approved ticket, proceed through the plan without re-asking per file.
   **Provenance first (KIT-T079):** on any module-identity question — "which file?",
   "why isn't X showing?", "is this the right module?" — run provenance BEFORE runtime
   theories (cache, zombie dev-server): `git log -- <path>` plus
   `code-graph --query entry-points` / `--query duplicate-defines <symbol>`. A repo can
   hold two of a module (one canonical, one superseded); git + the graph say which
   outright. Edit the canonical twin, never whichever you opened first.
   **Two LIVE surfaces is not a pick (KIT-T227):** two editors, twin modules, or
   duplicate configs of one concern → STOP and ask which is canonical.
3. Set `status: doing`. Mirror each acceptance criterion into the native task
   list as a task titled `T-NNN <criterion>` (TaskCreate, with blockedBy for
   ordering) — the prefix marks it as ticket-backed. **The ticket file is truth;**
   the native list is a live projection kept in lockstep (see Native task sync).
4. As each criterion is satisfied, check its box `[x]`, append a `## History`
   line for structured events (status changes, blockers, decisions — stamped by the
   `t` CLI), and append narrative context to `## Notes` by hand (prose, free-form,
   direct-edit). **History = structured timestamped events (never edit); Notes =
   prose progress (append freely).** Both sections are append-only (KIT-D037).
5. When all criteria pass: set `status: review`, record `(fixed) <sha>` + the
   `fixed_commit` frontmatter in History, stop, summarize the diff.
   **Evidence floor (KIT-T061):** the closing transition (→`review` when
   `config.uat: required`, →`done` when `none`) requires the ticket's Notes/History
   to cite a **test artifact** — a test path, a suite-run reference (`npm test`,
   "N passed"), or the test/fixing commit sha — OR an explicit `[no-test: <reason>]`.
   The commit gate blocks the commit otherwise; "review/done" must mean test-backed,
   not self-asserted.
6. `done` is a `statuses.human_only` status: I never close on my own judgment. When Chris
   reports a fix works ("it's fixed"), I close at once with `t status <id> done --human` and
   link `fixed_commit` — never hand back `/done <id>` (KIT-D125). On done, the ticket moves
   to `.ai/tickets/archive/`.

### The capture → delegate → stay-free cadence (KIT-D015 — a resume-RESTATED mode)
The loop that makes `/clear` consequence-free: **capture** every observation to disk the
moment it lands (the request ratchet enforces it), **delegate** substantial work to
subagents, and **stay free** to clear at any point because nothing lives only in context.
This cadence is itself **restated on every resume** (orient replays it), not a fact held
in the conversation — so a cold session re-enters it without being told. The on-disk
guarantees that back it:
- **In-flight delegated agents** are recorded automatically in `.ai/agents.jsonl` (a
  PostToolUse(Task) hook appends a row per delegation; SubagentStop marks completion). orient
  replays them under **In-flight agents** at SessionStart, and flags any uncollected one. So a
  `/clear` mid-delegation never orphans the work — the resume sees the roster and reattaches
  (TaskList / the agent's output) or reconciles it. If you ever dispatch outside the hook,
  record it yourself: `recordAgent(root, { id, status, task, scope })`.
- **The SESSION.md anchor stays live**: the Stop-time anchor ratchet (flush.mjs) nudges once
  if work landed this turn (a commit / a durable-store edit) without SESSION.md being touched —
  so the anchor a resume reads is never stale between flushes.
- **Trust the floor, not your memory**: at resume, the roster + SESSION + git ARE the state.
  Reconcile to them and say so; never reconstruct delegated work from a chat summary.

### Native task sync (.ai/ ↔ native list)
The native task list is a **live, bidirectional projection** of the tickets — the
ticket file stays the durable truth (native tasks are per-session + machine-local).
Config: `.ai/config.yml` → `native_task_sync`. Because I am the only writer of native
tasks, keeping both in lockstep IS the sync:
- **Hydrate on start:** rebuild the native list from the active ticket(s) at `/work`
  start — `node <kit>/scripts/sync-tasks.mjs` emits the task spec from `.ai/tickets/`.
  (Native tasks don't survive the session; the ticket does.)
- **Lockstep:** when a ticket's status or a criterion changes, update the matching
  native task in the same step — and write any native status change back to the ticket.
- **Prefix:** every ticket-backed native task is titled `T-NNN …` so it's visibly
  distinct from ad-hoc tasks. Status maps per `native_task_sync.status_map`.
- **Promote orphans:** a native task with no `T-` prefix is unpersisted work — capture
  it to `.ai/inbox/`, then re-title the native task with the id triage assigns.
  Nothing important is left living only in the ephemeral list.

### Every store write goes through a command (KIT-T509)
A hand Write/Edit of a store file is a defect: the command mints the id, validates, stamps
History and regenerates the views. The pre-write hook (check-id `store-write`) refuses a hand
**creation** of a typed-store file, a hand Edit/Write of an existing item (KIT-D120), and any write to
`SESSION.md`, the generated views and the hook-owned logs, and names the command. A new item type gets its own verb or joins `t`.
| Write | Command |
|---|---|
| ticket | `t new <type> "<title>" [--description|--file]`, `t status`, `t tick`/`untick`/`criterion`, `t link`, `t comment` |
| ticket/epic/request/note Notes prose | `t notes <id> "<prose>"` appends; `t edit <id> --section Description\|Plan\|Notes --file <path>` replaces (a hand Edit of an existing item is refused, KIT-D120) |
| decision | `t decide --file <draft.md>` |
| question | `t question "<q>"`, `t ask`, `t resolve` |
| red-by-design test (named debt the red-test gate exempts) | `t red-by-design add <test> --decided-by <id,...> --reason "<why>" [--owner <who>]` (renews the date), `remove <test>`, `list`; one file per entry in `.ai/red-by-design/` |
| note / epic / request | `t note` / `t epic` / `t request "<title>" [--body|--file]`; `t status`/`t tick` also address epics and requests |
| inbox capture, resolved event | `cap [type] "<text>"`, `cap --done`; promotion by `triage.mjs --plan/--apply` |
| reminder | `rem add`/`done`/`snooze` |
| SESSION.md anchor | `t session "<text>" | --file <draft> [--append]` |
| INDEX / REGRESSIONS / ROADMAP | `index-tickets.mjs` (every `t` verb runs it) |
| agents.jsonl, progress, receipts | hooks, `t ack`; never by hand |
Exclusions: `store-write` in `.claude-kit-ignore.yaml` or a `claude-kit-ignore-file store-write` marker.
