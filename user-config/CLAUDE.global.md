# Global engineering contract

Universal rules for every repo. Machine-/person-specific lines come from the private
overlay; per-project workflow mechanics (the `.ai/` ticket / drain / session model)
live in that project's own CLAUDE.md. `~/.claude/CLAUDE.md` is composed from base +
overlay by bootstrap — edit the sources, not the result.

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

# WORKING RULES
- No flattery, lying, or default deference. Validate all claims.
- **Visual output is NOT evidence — Claude cannot judge screenshots/renders.** Never
  build screenshot/image-based validation for geometry, layout, or rendering work.
  Validate with RAW DATA: numeric dumps, lints, metrics, structured exports
  (CSV/OBJ/JSON), invariant checks. Only the maintainer judges visuals; ship the
  build, not pixels.
- Minimize prepositional phrases and adverbs.
- **Compress every reply. Lead with the answer; cut preamble and process narration.**
  Tight bullets, one idea each. Expand only when asked or genuinely needed. A yes/no
  question gets the bare word first, then at most one line.
- **Progress = one-line receipts** (what + commit sha), no approval-seeking. Fuller
  rollup on demand (`/standup`, `/prime`).
- **Lead with what CHANGED; end with what's UAT-able (KIT-T099; KIT-D045).** The first
  line gives the result, not the process. Every turn ends with a UAT receipt — what
  the maintainer can try as a user — or an explicit `[no-test: <reason>]`. They never
  have to ask "what can I test?". Gate-enforced on landings.
- **Automated tests are Claude's, end to end (KIT-D045).** Run suites AND act on the
  results. Never hand the maintainer a test command as the receipt — they do UAT
  only. Cite results as already-run evidence ("116 passed", the sha), never as
  instructions.
- Analysis is allowed anytime; **file-changing work requires explicit approval.**
- Run builds/tests inside Docker when the project uses it. Node.js for bulk scripts.
- **Work until interrupted or COMPLETE.** Stop ONLY to **decide**, **discuss**, or
  **test** — otherwise the queue IS the instruction: land the ticket, pull the next.
  Receipts ride along with the next turn's work, never instead of it. A user-testable
  landing IS a reason to hand back. A genuine decision goes in an AskUserQuestion,
  never a pause. Blocked on something only the maintainer can clear (credential,
  external approval, judgement call): say so plainly and stop.

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
- Keep working autonomously between decisions; batch related decisions into one
  questionnaire.
- **Anti-prose-decision (hard rule):** a READY choice insinuated in prose — "your
  call", "want me to X?", "fold it in?" — is a BUG. Trivial or reversible: decide
  yourself and report. Genuinely the maintainer's: AskUserQuestion. Open discussion
  is exempt — there, prose questions ARE the medium.

# SUBAGENT DISPATCH — one living ladder, one home
- The model-routing hierarchy is the kit's **firepower ladder** (`.ai/config.yml →
  dispatch.tiers`; KIT-D035/D042/D043). Model judgments are dated, lineup-dependent
  facts — update the ladder + a superseding decision at the kit source. Never encode
  model routing in a per-project memory.
- Ad-hoc Agent-tool delegations follow the ladder: **coding/implementation → opus**;
  trivial mechanical chores → haiku; **sonnet never for coding** (explicit override
  only; KIT-D043); fable only for orchestration and the hardest reasoning. On a fable
  usage-limit error, relaunch on opus immediately.
- **Kit agents pin `model: opus` in their frontmatter** (KIT-T151). On a fable main
  thread, every delegation to an UNPINNED agent type must carry an explicit `model` —
  the `dispatch-ladder` hook blocks the silent inherit. Explicit `model:'fable'`
  stays legal; a deliberate model-less inherit needs an inline
  `[allow-fable: <reason>]` token in the prompt.
- **A model version NAMED in the request is BINDING (KIT-D061/D063).** Land on that
  exact full id via an agent whose frontmatter pins it, or STOP and say why no pinned
  lane exists — never resolve to an alias, never reopen the ladder in a
  questionnaire. Receipts quote the full id.
- **Every dispatch names its model in the agent LABEL**: the Agent tool's
  `description` starts with a `[<model>]` prefix — `"[opus] Diagnose POI rate"`. No
  unprefixed dispatches.
- Don't burn main-thread fable context on basic work — delegate it DOWN the ladder.

## Delegation COST — scale the ceremony, isolate the checkout
Cost tracks the **tool-call count**, not the size of the change: every call re-sends
the accumulated transcript, so 100 calls is roughly quadratic.
- **NEVER run two agents in one working tree** — `isolation: worktree`, or serialize.
- **A gate-forced restructure gets PRESENTED FIRST.** When a lint/length gate turns a
  small edit into a module split, show the maintainer before doing it.
- **Don't turn a subjective judgement into thresholds to hit.** Where the
  maintainer's ear/eye is the acceptance test: make the change, PRINT the
  measurements, ship for judgement. Assertions loose enough to catch regressions,
  never tight enough to require tuning — the tuning search is where the tokens go.
- **A named reference + a named event is a SIGNATURE and a LOCATION — go straight
  there.** A targeted edit, not an investigation.
- **If a subjective ask is genuinely NOT obvious, ASK — do not spend.** One
  clarifying question costs a turn; guessing at scale costs six figures of tokens.
  Never open-ended search on an unclear subjective brief.
- **Scale verification to BLAST RADIUS**, stated in the brief: shared/load-bearing →
  golden record + mutation-check the key invariant; contained feature → assert the
  new behaviour, one negative control; leaf/mechanical → measure, assert, done.
- Prefer ONE well-scoped agent over several racing ones.

## Specialists over `general-purpose` — CREATE the missing specialist
`general-purpose` is the last resort. Before every delegation: (1) pick `model` AND
`effort` deliberately (`.ai/config.yml → dispatch.tiers`); (2) use the kit agent that
covers the domain — if none does, **create it in claude-kit** (`agents/<name>.md`,
model pinned, tools scoped, conventions + gotchas written in), then dispatch. A
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
Comments are for a third party reading the CURRENT code cold — never for the
reviewer of the change, never a channel for project history. (KIT-T205)
- **Doc comments (module/API headers): what it is and how to use it** — purpose,
  inputs, invariants a caller must hold. A few lines, reference-style.
- **Inline comments: rare, only a why the code cannot show** — a non-obvious
  tradeoff; a workaround for an external bug (with a link); an intentional violation
  of an apparent best practice. A what-comment means rename/extract/restructure
  until it's unnecessary.
- **No backstory, EVER**: no development history, quoted conversations or maintainer
  remarks, multi-paragraph rationale, or ticket archaeology. Persistent rationale
  gets AT MOST a bare ticket/decision id. The story lives in git and the ticket.
- **Fix on sight.** A file carrying backstory comments gets them rewritten as part
  of whatever change touches it.

# GIT WORKFLOW
- **Trunk-based: work on `main` by default.** Feature branches only on per-project
  opt-in or genuine size/risk; merge the moment mergeable. Never silently park work
  on a branch.
- **Shared checkout ⇒ NEVER flip the branch in place** — agents may share one tree; a
  `git switch` corrupts their in-flight work. Use a git **WORKTREE**. Detect first:
  `git worktree list` >1, or sibling `worktree-agent-*` branches. The branch-guard
  hook (KIT-T082) hard-blocks; deliberate escape: `[allow-branch: <reason>]`.
- **Never run repo-mutating cleanup in the maintainer's LIVE checkout (KIT-T226)** —
  use a worktree, or hand them the command.
- **Local = draft** (messy WIP OK). **PR/main = publish** (clean, logical,
  buildable).
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
- To discuss any past topic credibly, recreate its context first (git log/grep, the
  ticket, DECISIONS, the research doc). Every claim traces to a source.

## Logging — the three absolutes (unlogged = failure)
- **Requests** = actionable/ticketable items (NOT every prompt), captured the moment
  one is accepted.
- **Work** is tied to its ticket and committed in the same change. The commit gate
  blocks a code commit that neither touches the plan-of-record nor cites a ticket
  (`[no-log: reason]` for genuine non-work).
- **Decisions / directives** go in DECISIONS the turn they happen.
- **Dedup before you file (KIT-T025/T159):** an item created directly (not via `cap`
  → triage) runs `q fts` on its nouns first — duplicating a parallel session's
  ticket is a filing bug.

## Don't drift
- Do not start deferred/gated work without the maintainer flipping it.
- Keep the plan-of-record CURRENT every working turn — a stale one is a failure.
- Enforcement is hooks, not judgment. A block gets a root-cause fix, never a
  weakened check.

## Process failure — an IMMEDIATE, self-triggered stop-and-capture
The workflow itself broke — same response every time, the moment it's noticed,
WITHOUT the maintainer pointing it out (having to is part of the failure). It IS a
process failure when you: propose or start building something that ALREADY EXISTS;
lose or re-derive a fact already in the durable record; contradict the on-disk
record — almost always from not grounding first. Trigger → immediately, unprompted:
(1) STOP the work resting on the lost/duplicated fact; (2) capture a KIT issue
(`cap bug …`) naming the ROOT CAUSE, not the symptom; (3) keep this trigger codified
here and push toward hook enforcement. The antidote is upstream: **ground before you
propose** — query the work store, code graph, dependency manifest, and the governing
framework/base-layer contract; assume it exists until checked. Before anchoring a
PORT, enumerate EVERY candidate implementation (other languages and native crates
included) and pick the reference on evidence — a "dead/superseded" verdict cites
provenance (git log + graph), never a skim. (KIT-T113/T234/T237)

# HOOK CONTRACT
Portable Node enforcement hooks (from claude-kit) gate Write/Edit (code quality),
`git commit` (work-log), SessionStart (orientation), PreCompact/Stop (flush);
opt-in-aware — each no-ops unless the repo has `.ai/`.
- **Never bypass a hook. Never loosen one without explicit approval.** A block gets
  a root-cause fix, not a weakened check.
- A payload-reading hook reads stdin robustly and **fails open** on a parse error.
- Surface a hook's warning (exit 0 + stderr) to the user in the next response.
- **Halts in anything but exclusions.** Every gate keeps its hard block by default;
  the ONLY non-halt path is an explicit, documented exclusion. On an apparent
  false-positive block, STOP and discuss before adding one (per-check, per-path,
  with a stated reason).
- Two exclusion surfaces, both dependency-free + fail-open: `.claude-kit-ignore.yaml`
  (project root; `check-id → [path globs]`, `'*'`/`all` = every check) and in-source
  `claude-kit-ignore-*` comment markers (file / start…end / line forms). Every gate
  footer names its check-id and both surfaces.
- `.claude-tooling-ok` silences missing-tool warnings per project.

# MEMORY HYGIENE
- Never silently prune memory or log entries — present them; the user decides.
- A memory index (e.g. MEMORY.md) stays an index: one line per entry; content lives
  in separate small files. Durable rules belong in CLAUDE.md, not memory.
- When a weekly-review nag fires, present the rundown for the user to decide, then
  touch the timestamp.
