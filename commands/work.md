---
description: Pick up a ticket — restate acceptance criteria, confirm scope, then execute
argument-hint: <ticket-id>
---
If no ticket id is given, do NOT guess one — tell the maintainer to use `/drain` (auto-pull
the next item) and stop. With an id, work exactly that ONE ticket and stop at `review`.

STRUCTURED mutations go through the `t` CLI (KIT-T075), never hand-edited frontmatter: status
flips (`t status <id> <state>`) and criterion ticks (`t tick <id> <ordinal|match>`) — each
validates, stamps History, regenerates the board, and ingests the cache in one invocation.
PROSE (Description / Notes body) stays direct-edit (Edit). `<kit>` = the claude-kit scripts dir.

Work ticket $ARGUMENTS per the contract:
1. Read `.ai/tickets/$ARGUMENTS*.md` and restate its acceptance criteria.
2. Confirm scope before editing files. Wait for OK if the plan changes scope or
   touches files not listed in the ticket.
3. Run `node <kit>/scripts/begin-task.mjs $ARGUMENTS --root <repo>` to get the structured
   handoff packet (ticket + governing trail + open criteria) before delegating (KIT-T029).
   `node <kit>/scripts/t.mjs status $ARGUMENTS doing`. Mirror each acceptance criterion
   into the native task list (TaskCreate) for live progress. If you DELEGATE this ticket to a
   subagent, route it from the kit capability table (KIT-T034, KIT-D079, KIT-D080): pass the Agent
   `model` (a FAMILY: sonnet, opus, haiku, fable) and `effort` resolved as — explicit ticket
   `model:`/`effort:` (per-axis override), else ticket `tier:` (a job name), else the ticket's
   `type` default — via `node <kit>/scripts/dispatch-ladder.mjs resolve --job <j>` or
   `--type <type>`. The table is read from the kit only; a project `dispatch:` block is ignored.
   A `local-qwen` family is dispatched through `scripts/local-agent.mjs` (docs/LOCAL-QWEN-LANE.md);
   after 2 failures on the ticket it escalates to the row's `fallback:` family. A job row is one
   family and one effort; never inherit the parent model by default (Opus-inheritance is the
   token bleed — KIT-D022). If the family is UNAVAILABLE at dispatch (the harness rejects the
   value), retry the same delegation on the row's `fallback:` family and say so in the receipt.
   The same choice applies when dispatch goes through a Workflow script: pass it as the
   `agent()` call's `model`/`effort` opts.
   When delegating, ROUTE to the right agent (KIT-T015):
   - Check for a project-local knowledge-agent at `<repo>/.claude/agents/<domain>.md` first.
     If one exists, route there — it carries conventions, past gotchas, and the out-of-scope
     guard so you don't need to re-explain them in the task prompt.
   - Else use the closest generic kit agent (researcher / refactorer / test-author /
     code-reviewer); bare general-purpose is the last resort.
   - Include these standard handoff guards in every delegation brief:
     > **Out-of-scope / legacy guard:** do not touch files, modules, or subsystems outside
     > the ticket's stated scope. If a fix traces to legacy or deprecated code outside your
     > domain, STOP and surface it — don't expand scope unilaterally.
     >
     > **One checkout, on main (KIT-D039):** work in the maintainer's checkout, on main — no
     > worktrees, clones, branches or second directories. Never `git stash` (KIT-T233); baseline
     > with `git diff > <file>` + `git checkout -- .`, or a WIP commit on main.
     >
     > **Two live surfaces = STOP (KIT-T227):** if you find two live implementations of
     > the same concern (two editors, twin modules, duplicate configs), do not pick one —
     > surface both with their provenance (`git log`, `code-graph duplicate-defines`) and
     > ask which is canonical.
     >
     > **Tuning against an instrument (KIT-T218):** a tune-to-a-target task carries an
     > explicit iteration/wall-clock budget; calibrate ONLY on the instrument that judges
     > the result (never a faster proxy that under-reads it); at budget exhaustion STOP
     > and report the best result with its measurements — never keep sweeping.
     >
     > **Verify as the user plays:** after completing your change, exercise it as the user
     > would — run the test suite, start the app, or hit the probe — and report empirical
     > evidence (exit code, rendered output, probe readings). A compile-check alone is not
     > verification.
4. Execute. Tick each criterion as satisfied with `node <kit>/scripts/t.mjs tick $ARGUMENTS
   <ordinal|match>`; append narrative progress to the ticket's Notes by hand (prose).
5. When all criteria pass, use `node <kit>/scripts/end-task.mjs $ARGUMENTS review --root <repo>`
   (or `done` when uat=none) to close programmatically — this delegates to `t status` and stamps
   History in one call (KIT-T029). Then stop and summarize the diff. Close (`status … done`) is
   gated by `config.uat`: agent-callable when it resolves `none` (KIT-D034), else maintainer via `/done`.

**BIG-ASK TRIGGER (KIT-T038):** when a request exceeds a size/risk threshold — long prompt AND a scope/risk signal (redesign, architecture, migrate, from scratch, overhaul, end-to-end, system-wide, etc.) — do NOT one-shot it. Route it into the structured pipeline: plan → research doc (`docs/research/`) → decompose into tickets → drain. Routine asks are unaffected. The `UserPromptSubmit` hook nudges this automatically; this prose is the authoritative rule for the contract.

**STATUS TRANSITIONS ARE MANDATORY (KIT-T028):** leaving a ticket in the wrong status is a
process failure — a zombie `doing` surfaces as a nag on every subsequent session start.
- Start work → set `doing` immediately (step 3 above).
- Finish work → set `review` (or `done` when uat=none).
- Bail / stop early / get reverted → set `todo` before exiting.
Never leave a ticket `doing` when you stop touching it.

## Search — q first (the kit's search tool)
When you or a subagent you dispatch searches, use `q.mjs` (`node <kit>/scripts/q.mjs`), never grep or rg: it indexes the repo and its
framework submodule — code in every language, docs, configs, tickets — and answers ranked, compact, exact.
- `q code <text> [--lang rust] [--path crates/x] [--regex -i -w] [-C 2] [--kind code|doc|config|ticket]`
- `q sym <name> [--type fn,struct,impl,use,mod]` · `q file <glob>` · `q fts <terms>` (work items) · `q show <id>`
- If q cannot do what you need, that is a kit bug or feature: `cap feature "q: <what is missing>" --project claude-kit`
  (a ticket the kit team builds) — never fall back to grep silently.
- Put this line in every dispatch brief: "Search with q.mjs (q code / sym / file / fts), never grep."
