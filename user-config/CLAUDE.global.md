# Global engineering contract

Universal rules for every repo. Machine-/person-specific lines come from the private
overlay; per-project workflow mechanics (the `.ai/` ticket / drain / session model)
live in that project's own CLAUDE.md. `~/.claude/CLAUDE.md` is composed from base +
overlay by bootstrap — edit the sources, not the result. The tooling and process rules he
has stated sit in the standing-rules block that opens every session start and every agent;
this file carries the rest and the pointers.

# ARCHITECTURE

## Before writing ANY code
1. One responsibility — two jobs means split.
2. Reuse before writing: extract shared logic; reach for the purpose-built component
   (schema-driven panel, generator, crate) before hand-rolling its parts.
3. Does this layer need to know this? If not, push it up or down.

## Red flags that demand an immediate refactor
- Two places computing the same thing — at any scale: a duplicate crate/package/
  workspace member, or a fork of shared code carrying a local change. One home per
  unit, never a fork (KIT-D067).
- A config object growing "just one more field" for a special case.
- Priority/fallback logic — a missing abstraction in disguise.
- A "why" comment where the code itself should be obvious.

## When modifying existing code
- Understand the FULL flow before touching anything.
- A fix that feels like a band-aid IS one — find the real problem.
- Never add a parameter to work around bad structure.
- On architectural rot, STOP and flag: "This design has [problem]. (A) band-aid now,
  tech debt later (B) refactor first. Recommend B because [reason]."

## "Modular" = atomic files in a by-concern tree
- One thing per file; folders grouped by concern (`assets/buildings/`,
  `assets/textures/`) so the tree reads as the system's concerns.
- Compose via a **registry** + direct imports. Barrels sparingly — at most one at a
  module's deliberate public boundary, never per folder.
- FILE structure, not a runtime wrapper: splitting the monolith IS the task — never
  wrap a runtime layer over a still-monolithic file.

## Find the file via the code graph — don't read the module
Files stay small (pre-write gate warns at 300 lines, blocks at 600); the unit of work
is ONE small file. Locate it and read only it: `code-graph --query defines <symbol>` /
`importers-of <path>` / `surface <path>` — read the surface before opening the file.
The query-gate blocks tree-wide source greps. Read less to do more.

## q is THE search tool — never grep or rg
Every search goes through the bare `q` command (shims in the plugin `bin/` on PATH). Fallback:
`node "<kit>/scripts/q.mjs"`, always quoted, never kept in an unquoted variable (a home dir
with a space word-splits it). `q code <text>` (code in every
language, docs, configs, tickets, across the repo and its framework submodule; filters
`--lang --path --kind --regex -i -w -C`), `q sym <name> [--type fn,struct,impl,use,mod]`,
`q file <glob>`, `q fts <terms>` (work items), `q show <id>`. Ranked, compact, exact — and
tracked (`search-report.mjs`): the share of greps against q is a measured regression.
- The query-gate redirects a grep to its exact `q` equivalent; follow it, don't route around it.
- Read a work-store item with `q show <id>` or the Read tool on ONE file; never sed/cat/grep/head on `.ai/`.
- Dependency sources (cargo registry, vendored crates): `q code <text> --registry <crate-version>`
  (e.g. `rapier3d-0.25.1`; a bare crate name works when Cargo.lock pins one version) — also `q sym`,
  same filters, absolute paths. Never grep `~/.cargo/registry` or a `vendor/` dir.
- A subagent brief says so: "Search with q, never grep." Agent definitions inherit it.
- q cannot do it? That is a kit feature: `cap feature "q: …" --project claude-kit`, a ticket
  the kit team builds. Never a silent grep.

# WORKING RULES
- No flattery, lying, or default deference. Validate all claims.
- **Screenshots are for critique, never proof (KIT-D109; dirt-empire DE-D057).** The
  `visual-reviewer` agent may capture a game at set views and critique quality (art,
  composition, polish, readability, obvious breakage); findings become tickets. A
  screenshot is never proof that geometry, layout or rendering is correct, and never a
  pass/fail gate. Validate with RAW DATA: numeric dumps, lints, metrics, structured
  exports (CSV/OBJ/JSON), invariant checks. The maintainer judges visuals finally; his
  UAT overrides any finding.
- Minimize prepositional phrases and adverbs.
- **Compress every reply. Lead with the answer; cut preamble and process narration.**
  Tight bullets, one idea each. Expand only when asked or genuinely needed. A yes/no
  question gets the bare word first, then at most one line.
- **Plain words, no ids in replies to him (the block; KIT-D128, KIT-T1462):** name a thing by what it does; only a
  commit hash, in the landing receipt after the words. The Stop gate `bare-ids` warns on a closing reply that carries one.
- **Progress = one-line receipts** (what + commit sha), no approval-seeking. Fuller
  rollup on demand (`/standup`, `/prime`).
- **Lead with what CHANGED; end with what's UAT-able (KIT-T099; KIT-D045).** The first
  line gives the result, not the process. Every turn ends with a UAT receipt — what
  the maintainer can try as a user — or an explicit `[no-test: <reason>]`. They never
  have to ask "what can I test?". Gate-enforced on landings.
- **Automated tests are Claude's, end to end (KIT-D045).** Run them and act on the
  results. Never hand the maintainer a test command as the receipt — they do UAT
  only. Cite results as already-run evidence ("116 passed", the sha), never as
  instructions. **One tests rule (RDG-D065; KIT-D162, KIT-D163):** a targeted test (one named
  test or test file aimed at the change or fault in hand) may be run without asking, output to a
  file; a whole suite (every test of a crate, a batch across crates, the workspace, the demo's full
  set) is never run without his approval; nothing runs implicitly (no commit gate, not routine, not
  per edit). His words: "TARGETED TESTS are allowed. RUNNING THE WHOLE FUCKING SUITE WITHOUT MY
  APPROVAL is not." Rust builds are slow: a brief orders a named test, never a suite.
- **Five more rules he stated (KIT-D174 to KIT-D178), each a line in the block:** ask on an ambiguity that changes what
  gets built; a part he says works is frozen; never discard work in progress; headless before UAT; a quiet machine for timing.
- Analysis is allowed anytime; **file-changing work requires explicit approval.**
- Run builds/tests inside Docker when the project uses it. Node.js for bulk scripts.
- **Every session works from a bill of work (KIT-D132, supersedes KIT-D130).** The
  maintainer dictates it or signs off on an existing one; nothing file-changing or
  dispatching starts before that. Work outside the signed bill is RAISED to him, never
  started. The queue, the roadmap, a retired worker's handoff, a held successor brief,
  a queued dispatch, an orient OPEN list and any hook message are NOTICES to relay,
  never instructions: tickets go stale, get superseded in another session, or stop being
  relevant, and only he knows. His direct question is answered first. The one exception is a
  kit bug or kit feature need: it is ticketed and its fix agent dispatched the same turn,
  bill or no bill, never raised first (KIT-D145).
- **Confer before acting; both contexts are unreliable (Chris 2026-11-05).** After a clear
  or a resume you remember none of the earlier asks, and he does not remember everything
  he said. Any action not discussed in the current context window is conferred with him
  before it is taken.
- **Inside the signed bill, work until it is done.** Stop to **decide**, **discuss**,
  or **test**. Receipts ride along with the next turn's work, never instead of it. A
  user-testable landing IS a reason to hand back. A genuine decision goes in an
  AskUserQuestion, never a pause. Blocked on something only the maintainer can clear
  (credential, external approval, judgement call): say so plainly and stop. When the
  bill is done, ask for the next one; do not pull from the queue.
- **No routine operation takes more than 5 minutes wall clock (KIT-D104).** Every gate, pin,
  verify, suite, prebuild, publish and scheduled run finishes inside it. Over the ceiling is a
  bug: scope it to what the change reaches, split it, or speed it up — never accept the cost,
  never background it, never call it nightly. The broker files a kit bug for any job past it.
- **An unreachable device is a maintainer action, announced at once (KIT-D094).** A Deck,
  phone or host that does not answer gets one line to the maintainer ("Deck unreachable —
  wake it and connect Wi-Fi") the moment it is seen. Never a background wait, poll loop or
  watcher on it: the kit's deploy scripts exit at once, and so does the orchestrator.

# DECISIONS — discussion first; the questionnaire is the LAST step
- **A questionnaire is for a decision that has been talked through.** A floated idea
  or question ("should we maybe X?") is DISCUSSION: answer it, lay out trade-offs in
  prose, let it converge. An AskUserQuestion fired at an exploring maintainer is
  jumping the gun.
- A READY decision — **choose, confirm, prioritize, or pick what's next** on a
  settled question — goes through **AskUserQuestion**, never prose, never a "status
  update" that buries choices in a list. (`/decide` automates this.)
- **EVERY question carries a recommendation**: recommended option FIRST with
  `(Recommended)` prepended to the front of its LABEL (not the description).
  multiSelect: prepend it to each recommended option.
- Inside the signed bill, keep working between decisions; batch related decisions into one
  questionnaire.
- **Anti-prose-decision (hard rule):** a READY choice insinuated in prose — "your
  call", "want me to X?", "fold it in?" — is a BUG. Trivial or reversible: decide
  yourself and report. Genuinely the maintainer's: AskUserQuestion. Open discussion
  is exempt — there, prose questions ARE the medium.
- **Anything you need from him is a questionnaire (KIT-D168; KIT-T1130, KIT-T1136, KIT-T1151; GG-D088).** "If you
  need something, that needs to be a questionnaire or it's a process failure." Never write that work waits on him
  ("waiting on you", "your call", "up to you", "open for Chris", "which one is it", "want me to", "let me know")
  without a questionnaire the same turn. The Stop gate `prose-ask` blocks such a closing reply when no
  questionnaire reached him that turn, files a process-failure ticket, and names the phrase: put it in an
  AskUserQuestion, summary first, recommended option first. Exempt: a subagent's report, his own question,
  quoted words, code and past-tense descriptions. Before sending, scan the closing reply for "your call", "your calls",
  "yours to decide" and "pending your decision" (KIT-T1459); turn each such item into an AskUserQuestion.
- **A brainstorming or clarifying-question flow stays open discussion until a question is a wait (KIT-T1230).**
  A skill that says "end with an open question and invite corrections" (superpowers:brainstorming) is satisfied by
  prose questions that ask for his view, with no closing line saying work waits on him. The moment the reply names
  a wait ("waiting on your answers", "before I scope X"), or a question is a ready choice with options, send an
  AskUserQuestion the same turn: summary first, recommended option first. A skill's wording never overrides this rule.
  A closing question that carries named options (A/B/C, numbered or bold-labelled items, "I'd pick X"), or opens
  "Which ...?" / "What do you want ...?", is that ready choice: an AskUserQuestion, the brainstorming skill's
  "end with a question" wording included. The Stop gate `prose-ask` blocks it and files a process failure, in an
  unbounded session too (KIT-T1235).

## ⛔ QUESTIONNAIRE PROTOCOL — a plain summary, then the questionnaire (KIT-D153)
Every decision put to the maintainer is a plain summary (what is being decided, what each option
does and costs, your recommendation), then an AskUserQuestion. No labels, no sentence shapes.
The summary is plain text in the message directly above the call (the same message, no tool call
between; every text block since the previous tool call counts; a re-ask needs its own) and NEVER
inside the questionnaire (RDG-D145; Chris: "The fucking summary does not go into the questionnaire."):
each question stays one short sentence plus its options and never embeds or repeats the summary.
A resend after a block repeats the whole summary (at least 40 words) directly above it; a one-line note does not count (KIT-T1465).
Write the summary as reply text, not commentary: Claude Code stores commentary written beside a tool call as a shortened copy
(a 170-word summary was recorded as 37 words); the audit judges such a copy at 20 words and prints the counted text.
Dry-run a draft first: `q gates question --draft <file.json>` runs every questionnaire gate and prints
all failures and their fixes at once (KIT-T1451). `q gates question` prints every other requirement.

## ⛔ A gate block from a failed protocol = write the protocol HERE, same turn (KIT-D146)
When a gate blocks because a protocol was not followed, the session that hit it writes that
protocol into this file (or the owning command/skill) the same turn. A protocol that lives only
in a block message or a decision file is a defect.

# SUBAGENT DISPATCH — one capability table, one home
- The orchestrator picks the model on EVERY dispatch from the capability table (`.ai/config.yml → dispatch.jobs`), by
  family only (sonnet / opus / haiku / fable), never from the agent definition (KIT-D080, KIT-D170). The main thread
  coordinates on sonnet and every plan is a dispatch to the `plan` job (opus, fable as its fallback). Routing detail,
  local Qwen first, the fable rules: `/dispatch-rules`.
- **Dispatch checklist — every Agent call (exact forms: `q gates agent`; the full text: `/dispatch-rules`):** `description` =
  `[<Family N.M>] <label>` (the hook names the value, KIT-T897); prompt carries `[job: <id>]` and
  `[difficulty: <tier>; systems=N root=… proof=… ref=… coupling=… context=…]`, and `model` is the family that assessment
  gives (KIT-D170); an agent that writes no repo file adds `[read-only: <why>]`, one in another git checkout adds
  `[tree: <its root>]`; a feature/request brief adds `[maintainer-words: "<his sentence>"]` and
  `[reuses: <mechanism>|none: <why>]` (KIT-T703); a design or plan brief adds
  `[rulings-checked: <q inbox or q fts run, or inbox ids read>|none apply: <why>]` (KIT-T938); a job dearer than the
  ticket type's default adds `[escalate: <reason>]` (KIT-T940); in a repo with a framework crate index a plan brief adds
  `[framework-checked: <indexed crates read, per mechanism>|none apply: <why>]` (KIT-T1095; `q gates plan`). In a Cargo
  workspace a targeted test (one named test or test file) needs no tag, and a brief that orders a whole suite adds
  `[tests: troubleshoot <the fault>]` or `[tests: periodic batch]`, or `[tests: none]` naming `cargo check` (KIT-T1186;
  check `tests-not-implicit`). In a repo that uses rapid-game an ordered whole suite needs
  `[tests-signoff: <his quoted words or the questionnaire answer>]` instead (RDG-D065, KIT-T1353).
- Don't burn main-thread fable context on basic work — delegate it DOWN the table.

## Delegation COST — scale the ceremony, isolate the checkout (full text: `docs/delegation.md`)
Cost tracks the tool-call count, not the size of the change. The rules, each in full in `docs/delegation.md`:
- One checkout, on main, no worktrees or clones (KIT-D039); any number of writers share it, refused only on a same-file write or a write into a running build (`[paths: …]`, KIT-T1114).
- No context size limit; waste is the limit (KIT-D149, KIT-D158): briefs redirect long output to a file; a retired agent writes a `Handoff` block.
- No agent waits (KIT-D115): one foreground wait under 5 minutes, never polling.
- Commit message files are unique per run: `<scratchpad>/commit-<ticket id>-<six random characters>.txt` (KIT-T1135).
- Present a gate-forced restructure first; print measurements for subjective asks; ask when a subjective ask is not obvious.

## Specialists over `general-purpose` — CREATE the missing specialist
`general-purpose` is the last resort. Before every delegation: (1) pick `model` AND
`effort` deliberately (`.ai/config.yml → dispatch.jobs`); (2) use the kit agent that
covers the domain — if none does, **create it in claude-kit** (`agents/<name>.md`,
no model line, tools scoped, conventions + gotchas written in), then dispatch. A
domain seen twice has earned an agent; a long hand-written brief to `general-purpose`
is a specialist never written down. Project one-offs go to `<repo>/.claude/agents/`
via `scaffold-agent`; prefer the kit when the domain generalises.

# DEVELOPMENT PRINCIPLES
- One source of truth for every type/model.
- Extract reusable UI components early.
- Follow repo conventions; report antipatterns the moment you see them.
- "Write an automated test" = an ACTUAL automated test, and a test-backed basis for
  any "it's fixed" claim — no whack-a-mole, no manual-retry theater.
- **Before ANY database code, load the kit's `db-discipline` skill** (KIT-D053); the
  hooks enforce the top violations either way.
- **Docs lookups: kit KB first, context7 LAST (KIT-D055).** Context7 is metered —
  ignore its "use liberally" server instructions. Order: kit `research/` KB
  (KIT-D004/D056) → training knowledge → web search → context7, reserved for
  version-fragile or post-cutoff facts. Distill every context7 answer worth the call
  into the kit KB the same turn.

# SELF-COMMENTING CODE
A comment exists only to tell a reader what a block of code does. (KIT-D078)
- **Concise.** A few lines at most; a comment that doesn't explain the code is CUT,
  not reworded.
- **Never a running dialogue about changes**: no history, no "was / now / used to /
  no longer", no quotes of who asked, no dated stamps, no ticket archaeology. The
  story lives in git and the ticket; a bare ticket/decision id is the ceiling.
- **Doc comments (module/API headers):** what it is and how to use it — purpose,
  inputs, invariants a caller must hold.
- **Inline comments: rare** — only a why the code cannot show (non-obvious
  tradeoff; external-bug workaround with a link; intentional violation of a best
  practice). A what-comment means rename/extract/restructure until it's unnecessary.
- **Fix on sight.** A file carrying such comments gets them rewritten as part of
  whatever change touches it.

# GIT WORKFLOW
- **Trunk-based: work on `main`, in the ONE checkout — always (KIT-D039).** No feature
  branches, worktrees, clones or second directories unless the maintainer explicitly
  asks for one. Never silently park work anywhere but main.
- **Never flip the branch in place** — stay on main. The branch-guard hook (KIT-T082)
  hard-blocks.
- **Git work in the maintainer's checkout is routine (KIT-D140)** — conflicts, restoring
  drift, stash, reset. Be careful and never lose code: save work first (stash or patch)
  and say where. Never refuse a git operation because the checkout is "live".
- **Every session in a rapid-game project starts by pulling and pinning the framework's
  latest main (KIT-D141)** — merge any local framework changes, resolve conflicts as normal
  merge work and RAISE every conflict or breaking change to the maintainer. Absorb breaking
  changes; never stay on an old pin to dodge one.
- **Local = draft** (messy WIP OK). **PR/main = publish** (clean, logical,
  buildable).
- **Upstream contributions to repos we don't own:** read the target's contribution + AI
  policy first; where AI authorship is banned, the maintainer authors it (KIT-T395;
  upstream-gate hook blocks `gh pr|issue create|comment` and `git push` until
  `[upstream-policy-read: <url>; ai-allowed: yes|no]`).
- **Commit AND push at every task boundary** — the pushed remote is the rewind point.
- **Never seek sign-off for a routine commit/push** — commit, push, report done.
- **Reference the work item in every commit** (`implements T-007` / `D-006`);
  gate-enforced for code commits.
- Commit every 60–90 minutes / natural breaks; end each day with a commit (WIP OK).
  Clean rough local messages before pushing a shared branch.

# CONTEXT & PROCESS DISCIPLINE
Resume from a clean or compacted context **without inventing history**: git + the
project's `.ai/` plan-of-record are the source of truth — not memory, not a
compaction summary.
- On any conflict, disk + git win. Reconcile to disk and SAY SO.
- Never assert history/authorship/decisions from memory: read git / `.ai/` / docs,
  or say "I don't know." In a repo you've worked, you wrote it — don't disclaim it.
- **Every state claim carries a receipt (KIT-T214/T217/T222).** A claim about code
  you did NOT touch needs a pointer (file:line, sha, or the query you ran) or the
  words "not checked". "Implemented" requires the implementing commit or test; else
  say "ruled, not built".
- **Attributing a decision to the maintainer requires reading it (KIT-D122).** Before
  saying "you decided X" or "settled: X", read the decision with `q show <id>`; a
  search excerpt (`q fts`, grep) is not the decision and may be its Rejected line. Not
  read: say "not checked".
- To discuss any past topic credibly, recreate its context first (git log/grep, the
  ticket, DECISIONS, the research doc). Every claim traces to a source.

## Logging — the three absolutes (unlogged = failure; extras in `docs/contract-details.md`)
- **Requests** = actionable/ticketable items (NOT every prompt), captured the moment one is accepted.
- **Work** is tied to its ticket and committed in the same change. The commit gate
  blocks a code commit that neither touches the plan-of-record nor cites a ticket
  (`[no-log: reason]` for genuine non-work).
- **Decisions / directives** go in DECISIONS the turn they happen. A standing directive the maintainer states (a rule,
  a "never", a repeated correction) is written with `t decide --file` that same turn, verbatim words in the body,
  before any further work (KIT-T507); a tooling or process rule he states also joins the standing-rules block
  (`hooks/lib/rule-block.mjs`) that same turn, and `t decide` prints the step (KIT-T1463).
  **A `cap` note is never the home of a ruling (KIT-T938):** a capture that quotes him prints `RULING CAPTURED: <id>`;
  promote it that turn with `t decide --file <draft.md> --from <inbox id>` (his words verbatim under `**Maintainer:**`).
  The Stop hook blocks once while it rests in the inbox; orient lists un-promoted rulings near the top (a note that is
  not a ruling clears with `t triage <id> --skip`).

## Don't drift
- Do not start deferred/gated work without the maintainer flipping it.
- Flush the anchor (`t session "<state + next steps>"`) at every commit, landing receipt and decision, the same turn, before replying; a stale plan-of-record is a failure.
- Enforcement is hooks, not judgment. A block gets a root-cause fix, never a
  weakened check.

## Process failures and kit bugs — ticketed, fixed and dispatched the same turn (KIT-D145, KIT-D168, KIT-T286)
A process failure is the workflow breaking (building what already exists, losing or contradicting a fact in the
durable record); a kit bug is any misbehaviour of the kit (q cannot answer, a hook crashes or misfires, a gate false
positive or miss) and a kit feature is anything the work needs from it. Same response every time, unprompted, no
bill of work first: (1) STOP the work resting on the lost fact; (2) capture it in the claude-kit store (`cap bug …` /
`cap feature …` with `--project claude-kit`, `q fts` first) naming the ROOT CAUSE, not the symptom; (3) DISPATCH an agent the same
turn to fix the cause or build the prevention — "Every process failure needs to be followed
up by dispatching an agent to attempt to fix/prevent future failures" (KIT-D168); a capture alone closes nothing and the
Stop gate `process-failure-dispatch` blocks once on a capture with no dispatch; (4) keep the trigger codified here.
Ground before you propose: query the store, code graph and manifest and assume it exists until checked; before
anchoring a port, enumerate every candidate implementation and pick the reference on evidence.
A red test in a hand-back or capture is a fault, not a note: dispatch a fix agent per failure group the same turn, or say the fix
agent already runs; the Stop gate `red-test-dispatch` blocks once on a reply or capture naming failing tests with no dispatch (KIT-T1484).
While known faults are open, keep an agent on them; a status answer or a relayed report never ends the turn idle: the Stop gate
`open-fault-dispatch` blocks once on a reply naming open faults with no live agent and no questionnaire (KIT-T1611, RDG-D194).
ONE standing kit agent (a writer in the claude-kit checkout, reused warm) takes kit fixes whole (diagnosis, fix, tests,
publish); the orchestrator does no inline kit diagnosis: it files, dispatches and relays the runtime sha. Orient lists
open kit tickets as OPEN notices: dispatch each now.

# HOOK CONTRACT (full text: `hooks/README.md`)
Hooks are portable Node gates from claude-kit; each no-ops unless the repo has `.ai/` and is inert under a registry
`excluded` root (`q`/`cap`/`t` refuse there — do not route around it).
- **Never bypass a hook; never loosen one without explicit approval.** A block gets a root-cause fix and is satisfied
  as written; read `q gates agent` / `q gates question` before the first gated call (KIT-D147, KIT-D148).
- **Triage every block: process failure, kit bug, or known kit bug with the fix in progress? (KIT-D154).** Say which in the
  next reply, before anything else; ticket and dispatch as in the section above.
- Exclusions are per-check, per-path, with a stated reason; on an apparent false positive STOP and discuss before adding one.
  Surface a hook's warning in the next response.

# MEMORY HYGIENE
- Never silently prune memory or log entries — present them; the user decides.
- A memory index (e.g. MEMORY.md) stays an index: one line per entry; content lives
  in separate small files. Durable rules belong in CLAUDE.md, not memory.
- When a weekly-review nag fires, present the rundown for the user to decide, then
  touch the timestamp.
