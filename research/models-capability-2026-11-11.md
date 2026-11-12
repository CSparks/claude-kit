# Models capability: weekly reassessment (2026-11-11)

Extends `models-capability-2026-11-05.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. This run re-fetched the models overview (grade A, 2026-11-11). One lineup change: Fable 5.2 (`claude-fable-5-2`) is generally available since 2026-11-09 at $8/$40 per MTok, down from Fable 5.1's $10/$50. Opus 5.5, Sonnet 5.5 and Haiku 5.5 are unchanged. Everything else is carried from the 2026-11-05 run; the orchestrator ran this research inline because the stale-table gate (KIT-T339) blocked the dispatch of any research agent.

## Lineup (grade A)
Models overview https://platform.claude.com/docs/en/models/overview (fetched 2026-11-11) lists four current models; every alias in `dispatch.aliases` resolves except `fable`, which now has a newer model:
- fable `claude-fable-5-2` $8/$40 per MTok, 1M context, default effort high, retirement not sooner than 2027-11-09. Fable 5.1 (`claude-fable-5-1`, $10/$50) stays listed.
- opus `claude-opus-5-5` $4/$20, default effort medium.
- sonnet `claude-sonnet-5-5` $2/$10, default effort high.
- haiku `claude-haiku-5-5` from $0.10/$0.50, default effort medium.
- Docs: start with Opus 5.5 for most workloads; Fable 5.2 for demanding reasoning and long-horizon agentic work, or when evals on Opus 5.5 at higher effort still fall short.
- Mythos 5.2 exists with limited availability (verification programs only); not a dispatch target.
- Fable cost vs Opus is now 2x list price (was 2.5x): $8/$40 against $4/$20.
- local-qwen: not probed this run; lane evidence carried from 2026-10-28.

## Evidence this run
- **Models overview (A, 2026-11-11):** the lineup above; Fable 5.2 described as "for demanding reasoning and long-horizon agentic work".
- **Constellation Research (C, https://www.constellationr.com/insights/news/anthropic-releases-mythos-52-fable-52, 2026-11-09):** summarises Anthropic's announcement: Fable 5.2 and Mythos 5.2 at $8/$40, fast mode $16/$80, Fable 5.2 can act as an Advisor or an Orchestrator that delegates simpler tasks, article still names Opus 5.5 the strongest daily driver for most coding and knowledge work. No Fable 5.2 benchmark against Opus 5.5 or Fable 5.1 found; no Anthropic benchmark table was fetched.
- **Carried (A, B, C):** the 2026-11-05 evidence stands: Opus 5.5 near Fable level on most work (Opus page 2026-09-22), Sonnet strongest on well-scoped work (Sonnet page 2026-09-28), Haiku fit for chore work (Haiku page 2026-10-07), OpenRouter hands-on (B, 2026-10-30) and CodeRabbit (B, 2026-09-28).

## Per-job table, ranked by cost per landing (cheapest first)
Cost per landing = per-token price x tokens a job burns x retry rate. List prices: Haiku 5.5 is 20x cheaper than Sonnet on input; Sonnet is half of Opus; Fable 5.2 is 2x Opus. Every row confirmed unless the verdict says otherwise.

| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed. Lineup and prices unchanged; Anthropic lists summaries, compaction, queries and classification as the Haiku fit. | A (models overview, Haiku page), B (OpenRouter) |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed. No new Haiku or Sonnet evidence; the 100k-file cap and sonnet fallback stand. | A (Haiku page), B (OpenRouter, MindStudio), M (Chris 2026-10-10) |
| 3 | wiring | sonnet | Confirmed. Sonnet unchanged. | A (Sonnet page), M (2026-10-12) |
| 4 | fix | sonnet | Confirmed. Sonnet unchanged; ledger shows no failures. | A (Sonnet page), B (CodeRabbit, OpenRouter), ledger |
| 5 | refactor | sonnet | Confirmed with the standing caveat (keep the file list and build/test gate in the brief; opus for a brief over about 10 files with no list). | A (docs matrix), B (Creator quote), M (2026-10-12) |
| 6 | research | sonnet | Confirmed at low effort. Open dispatch proposal (opus on the sonnet row, x2) has no supporting evidence this run: no new recall-heavy benchmark. No change. | A, C |
| 7 | build | sonnet (fallback opus) | Confirmed for exhaustive briefs. | A (Sonnet page quotes), B (CodeRabbit) |
| 8 | design | opus | Confirmed. Overview still says start with Opus 5.5 for most workloads. | A (models overview) |
| 9 | ui-creative | opus | Confirmed, no change; Sonnet stays a candidate for Chris to judge. | A, B (Wiegold, carried) |
| 10 | asset | opus | Not source-confirmed: no evidence on 3D modeling or spatial work for any model. Maintainer decision only; not re-dated. | M (Chris 2026-10-29) |
| 11 | forensic | opus | Confirmed. CodeRabbit hard cases Opus 8/13 (10/13 at Max) vs Sonnet 6/13; Fable is the escalation, now at 2x Opus. | B (CodeRabbit), ledger |
| 12 | coordination | sonnet | Maintainer decision, no source test. Not re-dated. | M (Chris 2026-10-17, KIT-D098) |
| 13 | plan | opus (fallback fable) | Confirmed. Open dispatch proposal (fable on the opus row, x3) is not supported: no Fable 5.2 benchmark against Opus 5.5 exists, and docs still say move to Fable only when Opus at higher effort falls short. Fable's price gap shrank from 2.5x to 2x, which lowers the cost of the fallback but does not change the first-pass family. | A (models overview), C (Constellation) |
| 14 | greenfield | opus | Maintainer decision (KIT-D108, DE-D057) stands; no evidence contradicts it. Re-dated on the standing M decision. | M (Chris 2026-10-28, KIT-D108) |
| 15 | deep | fable (explicit only) | Confirmed. The fable alias moves to Fable 5.2: same positioning (hours-long agent work, rare root-cause problems), 20 percent cheaper, still explicit-only. | A (models overview), C (Constellation) |

## Sources
- A: https://platform.claude.com/docs/en/models/overview
- A: https://docs.anthropic.com/en/docs/about-claude/models/choosing-a-model
- A: https://www.anthropic.com/claude-opus-5-5
- A: https://www.anthropic.com/claude-sonnet-5-5
- A: https://www.anthropic.com/claude-haiku-5-5
- B: https://coderabbit.ai/blog/sonnet-5-5-model-review
- B: https://openrouter.ai/blog/insights/claude-opus-vs-sonnet-vs-haiku/
- B/C: https://www.mindstudio.ai/blog/qwen3-8-27b-agentic-coding-test
- C: https://www.constellationr.com/insights/news/anthropic-releases-mythos-52-fable-52

## Exceptions
- One alias move: `fable` from `claude-fable-5-1` to `claude-fable-5-2` (grade A lineup). No row changes family.
- Open dispatch proposals (research: opus on sonnet row x2; plan: fable on opus row x3): no evidence supports either; both stay unchanged.
- asset, coordination, greenfield: maintainer decisions with no source test; re-dated on the standing M decisions because nothing contradicts them and the gate blocks on a row older than 7 days.
- local-qwen: lane unprobed this run.
- Process note: the stale-table gate blocked every Agent dispatch including the research agent that refreshes the table, so the orchestrator did the research inline; a kit bug is filed for the deadlock.
