# Models capability: weekly reassessment (2026-11-18)

Extends `models-capability-2026-11-11.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. This run re-fetched the models overview (grade A, 2026-11-18): the lineup, prices and Anthropic's model guidance are unchanged since 2026-11-11. No new B or C source was gathered this run: the agent that ran it had no web-search tool, only a fetch of the public Anthropic page, so the hands-on and aggregator evidence is carried with its original dates and the week's dispatch-outcome ledger is added. The stale-table gate (KIT-T339) had blocked every new dispatch, so the kit agent already running did the refresh.

## Lineup (grade A)
Models overview https://platform.claude.com/docs/en/models/overview (fetched 2026-11-18) lists four current models; every alias in `dispatch.aliases` resolves to the newest model of its family:
- fable `claude-fable-5-2` $8/$40 per MTok, 1M context, 128K output.
- opus `claude-opus-5-5` $4/$20, 1M context, 128K output.
- sonnet `claude-sonnet-5-5` $2/$10, 1M context, 128K output.
- haiku `claude-haiku-5-5` from $0.10/$0.50, 1M context, 128K output.
- Guidance, unchanged word for word: "start with Claude Opus 5.5 for most workloads. Use Claude Fable 5.2 for demanding reasoning and long-horizon agentic work, or when your evals on Claude Opus 5.5 at higher effort still fall short."
- Mythos 5.2 ($8/$40) is listed as a specialized model with limited availability; not a dispatch target. Fable 5.1 and older models remain listed as legacy.
- local-qwen: not probed this run; lane evidence carried from 2026-10-28.

## Evidence this run
- **Models overview (A, 2026-11-18):** the lineup and guidance above; no new model, price or retirement since 2026-11-11.
- **Dispatch-outcome ledger (claude-kit, road-generator, groovegrid stores, 2026-11-11 to 2026-11-18):** fix on sonnet 455 dispatches (about 250k tokens each), fix on opus 77 (about 508k), fix on fable 24 (about 533k); build on fable 222 (about 523k), build on opus 112 (about 405k), build on sonnet 7 (about 271k); asset on opus 147 (about 471k) and on fable 15; research on sonnet 84 and on opus 22 (about 91k each); plan on opus 15 (about 307k); design on opus 13; forensic on opus 4; greenfield on opus 2. The ledger records no failed outcome for any row, so it shows use and token cost, not quality. The heavy fable and opus use on fix and build follows road-generator's time-boxed owner order (RDG-D118: Opus 5.5 floor, Fable allowed, until 03:00 2026-11-18), not a table change.
- **Carried (A, B, C):** Opus 5.5 near Fable level on most work (Opus page 2026-09-22), Sonnet strongest on well-scoped work (Sonnet page 2026-09-28), Haiku fit for chore work (Haiku page 2026-10-07), OpenRouter hands-on (B, 2026-10-30), CodeRabbit (B, 2026-09-28), Constellation on Fable 5.2 (C, 2026-11-09).

## Per-job table, ranked by cost per landing (cheapest first)
Cost per landing = per-token price x tokens a job burns x retry rate. List prices: Haiku 5.5 is 20x cheaper than Sonnet on input; Sonnet is half of Opus; Fable 5.2 is 2x Opus. From the ledger, a fix landing costs about 250k tokens on sonnet and about 508k on opus: an opus fix costs about 4x a sonnet fix (2x price, 2x tokens).

| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed. Lineup and price unchanged. | A (models overview 2026-11-18, Haiku page), B (OpenRouter) |
| 1 | run-monitor | haiku | New row 2026-11-18 (KIT-D171): submitting a run, waiting on its finished.log line and reading the filtered result is automation. | M (Chris 2026-11-18: "Agents running and monitoring if ever that's needed from an actual agent should be Haiku.") |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed. No new Haiku or Sonnet evidence; the sonnet fallback stands. | A (Haiku page), B (OpenRouter, MindStudio), M (Chris 2026-10-10) |
| 3 | wiring | sonnet | Confirmed. Sonnet unchanged. | A (models overview 2026-11-18, Sonnet page), M (2026-10-12) |
| 4 | fix | sonnet | Confirmed. 455 sonnet fix dispatches at about 250k tokens each against 77 opus at about 508k: sonnet stays the cheapest landing. | A (Sonnet page), B (CodeRabbit, OpenRouter), ledger 2026-11-18 |
| 5 | refactor | sonnet | Confirmed with the standing caveat (file list and build gate in the brief; opus for a brief over about 10 files with no list). | A (docs matrix), B (Creator quote), M (2026-10-12) |
| 6 | research | sonnet | Confirmed at low effort. Ledger: sonnet and opus research cost the same tokens per landing (about 91k), so opus adds only price. | A, C, ledger 2026-11-18 |
| 7 | build | sonnet (fallback opus) | Confirmed for exhaustive briefs. The week's 222 fable and 112 opus build dispatches came from the RDG-D118 floor order, not from sonnet failures. | A (Sonnet page quotes), B (CodeRabbit), ledger 2026-11-18 |
| 8 | design | opus | Confirmed. Overview still says start with Opus 5.5 for most workloads. | A (models overview 2026-11-18) |
| 9 | ui-creative | opus | Confirmed, no change; Sonnet stays a candidate for Chris to judge. | A (models overview 2026-11-18), B (Wiegold, carried) |
| 10 | asset | opus | Not source-confirmed: no evidence on 3D modeling or spatial work for any model. Maintainer decision stands. | M (Chris 2026-10-29) |
| 11 | forensic | opus | Confirmed. CodeRabbit hard cases Opus 8/13 vs Sonnet 6/13; Fable stays the escalation at 2x Opus. | B (CodeRabbit), A (models overview 2026-11-18) |
| 12 | coordination | sonnet | Maintainer decision, no source test. | M (Chris 2026-10-17, KIT-D098) |
| 13 | plan | opus (fallback fable) | Confirmed. The overview still sends work to Fable only when Opus at higher effort falls short; no Fable 5.2 benchmark against Opus 5.5 found. | A (models overview 2026-11-18), C (Constellation 2026-11-09) |
| 14 | greenfield | opus | Maintainer decision stands; no evidence contradicts it. | M (Chris 2026-10-28, KIT-D108) |
| 15 | deep | fable (explicit only) | Confirmed. Same positioning (demanding reasoning, long-horizon agentic work), price unchanged. | A (models overview 2026-11-18), C (Constellation 2026-11-09) |

## Sources
- A: https://platform.claude.com/docs/en/models/overview (fetched 2026-11-18)
- A: https://docs.anthropic.com/en/docs/about-claude/models/choosing-a-model
- A: https://www.anthropic.com/claude-opus-5-5
- A: https://www.anthropic.com/claude-sonnet-5-5
- A: https://www.anthropic.com/claude-haiku-5-5
- B: https://coderabbit.ai/blog/sonnet-5-5-model-review
- B: https://openrouter.ai/blog/insights/claude-opus-vs-sonnet-vs-haiku/
- B/C: https://www.mindstudio.ai/blog/qwen3-8-27b-agentic-coding-test
- C: https://www.constellationr.com/insights/news/anthropic-releases-mythos-52-fable-52
- Ledger: `.ai/dispatch-outcomes.jsonl` of claude-kit, road-generator and groovegrid, 2026-11-11 to 2026-11-18

## Exceptions
- No new hands-on or aggregator source this week: this run had no web search, so B and C evidence is carried with its original dates. A run with web search should look for a Fable 5.2 against Opus 5.5 comparison and fresh Sonnet 5.5 hands-on reports.
- asset, coordination, greenfield rest on maintainer decisions with no source test; re-dated on those standing decisions because nothing contradicts them and the gate blocks on a row older than 7 days.
- Cost note for Chris: under RDG-D118 the week ran 222 build and 24 fix dispatches on fable at about 2x opus price and about 2x sonnet tokens; that order lapsed at 03:00 2026-11-18 and the table rows were not changed by it.
- local-qwen: lane unprobed this run.
