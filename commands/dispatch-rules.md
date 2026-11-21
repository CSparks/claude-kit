---
description: The full subagent dispatch rules - model routing from the capability table, the dispatch checklist with every tag form
argument-hint: ""
---
The full text of the global contract's dispatch rules (the contract keeps the checklist's tag forms and a pointer here).
The exact forms every gate prints: `q gates agent`.

- Agent definitions carry NO `model:` line (KIT-D080). The orchestrator picks the model on
  EVERY dispatch from the kit's **capability table** (`.ai/config.yml → dispatch.jobs`: job
  type → family or `local-qwen`, each row with cost, evidence date and source; fed by the
  research refresh and our own dispatch outcomes). Model judgments are dated facts — update
  the table + a superseding decision at the kit source. Never encode routing in a memory.
- A dispatch names a FAMILY only (sonnet / opus / haiku / fable), which resolves to that
  family's newest model. No exact-version requests: an older version gets a plain "can't
  target that" and nothing runs silently (supersedes KIT-D061/D063).
- Straightforward targeted change → **local Qwen first** (`scripts/local-agent.mjs`; the
  brief supplies files, line ranges, acceptance); after 2 failures on one ticket → sonnet.
  Straightforward fixes and multi-file refactors → sonnet; big or spatially heavy builds,
  design, asset authoring → opus; trivial chores → haiku. **Planning is separate from
  coordination** (KIT-D098; Chris: "Opus for planning, Sonnet for coordination."): the main
  thread coordinates on sonnet (`/model sonnet`) and every plan is a dispatch to the `plan`
  job, which runs on opus with fable as its fallback (fable costs 2.5x opus; explicit-only
  otherwise, never asset authoring). On an opus usage-limit error on a plan, relaunch on fable.
- Whatever the main thread's model, every dispatch carries an explicit `model`; the
  `dispatch-ladder` hook blocks a silent inherit of fable. A deliberate model-less fable inherit
  needs an inline `[allow-fable: <reason>]` token in the prompt. SessionStart orient flags a
  main thread that is not on the coordination family and names the `/model` switch.
- **Dispatch checklist — every Agent call (exact forms: `q gates agent`):** `description` =
  `[<Family N.M>] <label>` (the hook names the value; never hand-written, KIT-T897); prompt carries
  `[job: <id>]` and `[difficulty: <tier>; systems=N root=… proof=… ref=… coupling=… context=…]`, and `model` is the family that
  assessment gives (KIT-D170: the job's difficulty decides the model, never the agent definition; both listed by `q gates agent`,
  one lookup: `node "<kit>/scripts/dispatch-ladder.mjs" resolve --job <job> --difficulty "<tag body>"`); an agent that writes no repo file (design/artifact: scratchpad only) adds
  `[read-only: <why>]`, one in another git checkout adds `[tree: <its root>]`; a feature/request
  brief adds `[maintainer-words: "<his sentence>"]` and `[reuses: <mechanism>|none: <why>]` (KIT-T703);
  a design or plan brief (job `plan`, or an analyst or researcher briefed with design words) adds
  `[rulings-checked: <q inbox or q fts run, or inbox ids read>|none apply: <why>]` while the inbox
  holds un-triaged notes (KIT-T938); a job dearer than the default of the ticket type the brief
  names (a design/opus dispatch with no ticket) adds `[escalate: <reason>]` (KIT-T940). In a repo
  that uses a framework with a crate index (rapid-game: `docs/CRATES.md`), a plan brief and every plan
  leaving plan mode (in the plan text) add `[framework-checked: <indexed crates read, per mechanism>|none apply: <why>]`
  (KIT-T1095; `q gates plan`). In a Cargo workspace a targeted test (one named test or test file) needs no tag,
  and a brief that orders a whole suite adds `[tests: troubleshoot <the fault>]` or `[tests: periodic batch]`, or
  `[tests: none]` naming `cargo check` (KIT-T1186; check `tests-not-implicit`). In a repo that uses rapid-game an
  ordered whole suite needs `[tests-signoff: <his quoted words or the questionnaire answer>]` instead (RDG-D065, KIT-T1353).
- Don't burn main-thread fable context on basic work — delegate it DOWN the table.
