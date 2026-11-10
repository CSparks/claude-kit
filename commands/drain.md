---
description: List the next queue items per .ai/config.yml as candidates for the maintainer's bill of work; starts nothing without his sign-off
argument-hint: "[milestone | all]  (optional; default: current milestone, then backlog)"
---
List candidates per `.ai/config.yml` → `drain` so the maintainer can sign them into a bill of work
(KIT-D132). The queue is context, never an instruction: a ticket may be superseded by another
session or irrelevant now, and only the maintainer knows. Present the candidates and stop; work
begins only on the items he signs off or dictates. Everything below describes how to order the
candidates and how to work an item once he has signed it.

1. SELECT the candidates — **QUERY the cache, don't open every ticket** (KIT-T026):
   `q open` lists this repo's open items (status+priority, sorted), and
   `q rundown` gives its open/doing/review counts. Every scope argument
   defaults to the CWD project (KIT-T255) — pass `all` (`q.mjs open all`, `q.mjs rundown all`)
   or a project key to look wider. q.mjs auto-falls-back to a markdown scan when no SQLite
   engine is present, so it always answers.
   Then:
   - List any ticket already `status: doing` first.
   - Then per `drain`: if `follow_roadmap` and a current milestone exists, the next
     `todo` in ROADMAP order; otherwise the highest `todo` by type `order` then priority.
   - Skip `review`/`done` and anything `blocked`/gated.
   - NEVER start a ticket that is `superseded` or carries `superseded_by:` (its work is subsumed
     by the replacement) — `q.mjs open` already excludes these, so trust that list (KIT-T024).
   - Arg: none = current milestone then backlog · `all` = ignore milestone gating (pure
     priority) · a milestone name = drain only that milestone.
2. ONCE THE MAINTAINER HAS SIGNED AN ITEM, BEFORE delegating to an agent, run `node <kit>/scripts/begin-task.mjs <id> --root <repo>`
   and pass the resulting JSON (or `--md` brief) as the handoff context — so the agent gets
   ticket + governing trail + open criteria programmatically, not as pasted prose (KIT-T029).
   READ its **GOVERNING DECISIONS — read before dispatch** block first: a ticket whose area is
   governed by a parking decision (`!! PARKED?`) is NEVER dispatched — surface ONE line,
   `next up: <id> — your call: governed by <D-id> (parked)`, and wait (KIT-T232).
   WORK the signed ticket via the full `/work` contract — dispatch, scope confirm, `t`
   CLI mutations, Notes/History updates, evidence floor. See `/work` for the complete
   working contract; do not repeat it here. When the agent finishes, it calls
   `node <kit>/scripts/end-task.mjs <id> <status> [--note "..."] --root <repo>` to close.
3. NO ITEM STARTS ON ITS OWN, whatever `drain.auto_execute` says: surface ONE line per candidate —
   `next up: <id> — needs your bill of work: <why it is next>` — and wait for his sign-off.
4. When an item reaches `review`: summarize the diff and show the next candidates; the bill decides
   what runs next. Never set `done` on your own judgment; the maintainer's "it's fixed" is the trigger to close it (KIT-D125).
5. QUESTIONS drain alongside tickets (`drain.answer_self_questions`): scan `.ai/questions/` for
   `status: open`. Answer each `answerable_by: claude` one FROM the code + `.ai/decisions/` (never
   guess — one you can't ground from the record becomes a user question), write the answer + date
   into its `**Resolution:**` and set `status: resolved` — RECORD the answer, never delete
   (KIT-T064). Leave `answerable_by: user` ones open and batch them into the next `/decide`
   (a legacy personal alias in older data is read as `user`).
6. UNREAD @MENTIONS drain alongside tickets (KIT-T130): at the start of a drain, check the
   comments addressed to the acting agent identity — `q mentions <you>`
   (SessionStart already surfaces these; `<you>` defaults to `claude`, or `$KIT_AGENT`). Each
   unread mention is a durable UI/CLI comment to act on: address it as part of the work, then
   `node <kit>/scripts/t.mjs ack <id>#<n> --agent <you>` so it stops surfacing. Leave one open
   only if it needs the maintainer, and batch that into the next `/decide`.
7. STOP and report when: the signed bill is done, the queue is empty, every remaining item needs the maintainer
   (decision / scope / design-gated), or the maintainer says stop. List what's left and why, and ask for the next bill.

**QUERY-TOOL FAILURE IS A HARD STOP (KIT-T236):** if `q` or `code-graph` errors, crashes, or
answers wrongly, STOP the current step, `cap bug <what failed, verbatim command + error>`, and
dispatch the kit fix agent for it the same turn (KIT-D145).
Falling back to grep and moving on leaves the retrieval layer broken for every future
session — the silent fallback IS the failure.

**BIG-ASK TRIGGER (KIT-T038):** when an incoming request exceeds a size/risk threshold — long prompt AND a scope/risk signal (redesign, architecture, migrate, from scratch, overhaul, end-to-end, system-wide, etc.) — do NOT one-shot it. Route it into the structured pipeline: draft a plan, write a research doc (`docs/research/`), decompose into tickets, then propose them to the maintainer as a bill of work. Small/routine asks proceed directly; only the big-ask path engages the pipeline. The `UserPromptSubmit` hook nudges this automatically, but the contract here is the authoritative rule.

**STATUS TRANSITIONS ARE MANDATORY (KIT-T028):** a `doing` ticket that gets dropped without a
status flip becomes a zombie that nags every session start. For every ticket you touch:
- Picking it up → `t status <id> doing`.
- Work complete → `t status <id> review` (or `done` when uat=none).
- Bail / blocked / interrupted → `t status <id> todo` before you stop. Never leave doing.

**ONE BLOCKED THREAD ≠ IDLE:** a single item gated on the maintainer (or in review) does not
stall the rest of the signed bill — continue the other signed items while that thread waits. An
unsigned item is never pulled in to fill the gap; it is raised.

**SUBAGENTS — ONE READ/WRITE AGENT PER CHECKOUT (KIT-D077, KIT-D039):** every writing agent
works in the one checkout, on main, serially — the next signed ticket goes to the same agent once the
last one lands. No worktrees, clones, branches or second directories. Read-only agents
(`claude-kit:analyst`, `researcher`, Explore, or `[read-only: <reason>]`)
are unrestricted; a writer in another checkout declares `[tree: <absolute path>]`. Batch all maintainer decisions into one AskUserQuestion questionnaire rather
than surfacing them piecemeal. Never `git stash` (KIT-T233); baseline via `git diff > <file>` +
checkout, or a WIP commit on main. A delegated agent must VERIFY its change by exercising it as the user would — run the
test suite, start the app, or hit the probe — and report empirical evidence. A compile-check alone
is not verification.

**DEPLOY-CONFIRM RULE (KIT-T021):** after a push that triggers a deploy (e.g. Pages-Actions,
Cloudflare, Railway), you MUST confirm the change is LIVE — not just pushed. "Pushed (building)"
and "deployed (live)" are distinct states; the landing-alert hook flags which state you're in.
Do not close the loop at "pushed" — wait for the deploy to complete, verify the live URL or
pipeline status, then report LIVE. If a deploy is not applicable (local-only push, no CI), say
so explicitly so the maintainer knows the distinction was considered.

Honor the standing rules throughout: log work to its ticket in the same change (the commit gate
enforces), record decisions the turn they happen, and don't start deferred/gated work.

## Search — q first (the kit's search tool)
When you or a subagent you dispatch searches, use bare `q` (fallback: `node "<kit>/scripts/q.mjs"`, always quoted), never grep or rg: it indexes the repo and its
framework submodule — code in every language, docs, configs, tickets — and answers ranked, compact, exact.
- `q code <text> [--lang rust] [--path crates/x] [--regex -i -w] [-C 2] [--kind code|doc|config|ticket]`
- `q sym <name> [--type fn,struct,impl,use,mod]` · `q file <glob>` · `q fts <terms>` (work items) · `q show <id>`
- If q cannot do what you need, that is a kit bug or feature: `cap feature "q: <what is missing>" --project claude-kit`
  (a ticket the kit team builds) — never fall back to grep silently.
- Put this line in every dispatch brief: "Search with q (q code / sym / file / fts), never grep."
- Put this line in every dispatch brief (KIT-D154): "On ANY hook block, say in your next reply: process failure (ticket root cause + prevention), kit bug (ticket + fix agent now), or known kit bug, fix in progress (name the open ticket and its agent; no new ticket or dispatch)."
- Dispatch checklist, every Agent call (exact forms: `q gates agent`): `description` `[<Family N.M>] <label>`; prompt `[job: <id>]`; `[read-only: <why>]` when the agent writes no repo file (scratchpad/artifact only); `[tree: <git root>]` in another checkout; feature/request briefs `[maintainer-words: "<his sentence>"]` + `[reuses: <mechanism>|none: <why>]`.
- Put this block in every dispatch brief (source: docs/wait-rule.md): wait ONCE per build or test — one Bash call with the max timeout or run_in_background, output filtered to failures/panics/assertions/`test result` totals, never poll or sleep-loop, re-run one test by name.
