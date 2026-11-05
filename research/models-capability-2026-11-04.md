# Models capability: weekly reassessment (2026-11-04)

Extends `models-capability-2026-11-01.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. This run re-read the models overview and platform release notes (grade A, fetched 2026-11-04): lineup, prices, default efforts and retirement dates are unchanged and no model is newer than Haiku 5.5 (2026-10-07); the newest release-notes entry (2026-11-03) announces no model. No new benchmark or hands-on source was gathered: every per-job verdict and all grade-B/C evidence below is carried from the 2026-11-01 run, not re-tested. The outcome ledger holds 3 rows (`dispatch-report.mjs`: fix/sonnet 2 landings 0 failures 168k tokens per landing; forensic/opus 1 landing 0 failures 43k), too few to move a row; "proposals: none".

## Lineup (grade A, anchor for KIT-T656)
Models overview https://docs.anthropic.com/en/docs/about-claude/models/overview lists exactly four current models, and every alias in `dispatch.aliases` resolves:
- fable `claude-fable-5-1` $10/$50 per MTok, cache reads $0.25, 1M context, default effort high.
- opus `claude-opus-5-5` $4/$20, cache reads $0.20, default effort medium.
- sonnet `claude-sonnet-5-5` $2/$10, cache reads $0.10, default effort high.
- haiku `claude-haiku-5-5` $0.10/$0.50 up to 100k prompt tokens, $0.50/$2.50 above, cache reads $0.01/$0.05.
- Platform release notes through 2026-10-30 and the newsroom show no model newer than Haiku 5.5 (2026-10-07). Docs name Mythos 5.1 as verified-orgs-only, not an alias.
- local-qwen: Qwen3.8-27B (Apache 2.0, 262k context). The router at 127.0.0.1:8080 refused the connection this run, so the lane was not probed.

## Evidence this run
- **Opus vs Fable (A, Opus 5.5 page, 2026-09-22):** Opus 5.5 performs at Fable 5.1's level on most work at 40% less than Opus 5; Terminal-Bench 4.0 Opus 66.4 vs Fable 55.8, FrontierCode 54.4 vs 50.3, CursorBench 57.8 vs 51.8, GDPval-AA 1846 vs 1735; "the gap between Opus 5.5 and Fable 5.1 is narrower than these scores suggest". Model-selection docs: start with Opus 5.5; move to Fable 5.1 only when evals at xhigh or max still fall short.
- **Fable 5.1 (A, https://www.anthropic.com/claude/fable):** positioned for multi-hour agent sessions, root-cause fixes, a one-in-a-million crash no other model found (Jane Street, Cognition quotes).
- **Sonnet vs Opus (A, Sonnet 5.5 page, 2026-09-28):** Sonnet Terminal-Bench 4.0 70.6 vs Opus 66.4 (effort differs), FrontierCode 46.2 (Max) vs 54.4, CursorBench 55.5 vs 57.8, GDPval-AA 1844 vs 1846, OSWorld 2.1 80.1 vs 81.8. Anthropic: "Opus 5.5 remains clearly stronger at complex, open-ended work requiring sustained judgment"; Sonnet is strongest at well-scoped everyday tasks and fixing bugs. Testers: Base44 118 app builds level with Opus 5 at 3.6 vs 7.7 iterations; Creator "when Opus 5.5 sets the architecture ... confident in letting Sonnet 5.5 implement it"; CodeRabbit moves simple and moderate reviews to Sonnet; Sonnet adds UI polish and design sense.
- **Haiku 5.5 (A, https://www.anthropic.com/claude-haiku-5-5, 2026-10-07):** Terminal-Bench 4.0 39.2 vs Sonnet 70.6; FrontierCode 46.4 vs Sonnet 52.1 (Xhigh); GDPval-AA 1620 vs 1840; OSWorld 2.1 offline 72.4 vs 83.9. Anthropic: summaries, compactions, database queries, classification, subagents on coding work. Cognition: Haiku 5.5 as Devin Fusion sidekick with Opus 5.5 lead holds FrontierCode 66.2 at lower cost. Choosing-a-model guide: start efficiency-first with Haiku and upgrade on a capability gap.
- **CodeRabbit (B, https://coderabbit.ai/blog/sonnet-5-5-model-review, 2026-09-28):** 13 hardest known-bug cases: Sonnet 5.5 6/13, Opus 5.5 8/13, Opus 5.5 Max 10/13; four cases defeated every Sonnet configuration. Sonnet's Claude calls cost about 40% of Sonnet 5's per review. Brick Studio build, one run: Sonnet 29 min, Opus 45 min, near-identical results, Opus slightly higher fidelity.
- **Qwen3.8-27B (B/C, https://www.mindstudio.ai/blog/qwen3-8-27b-agentic-coding-test, 2026-08-15):** two independent testers fixed a multi-service Docker bug with no hints and reported zero failed tool calls over a multi-hour session; vendor SWE-bench Pro near 62 (self-reported). Nothing new since 10-28.

## Per-job table, ranked by cost per landing (cheapest first)
Cost per landing = per-token price x tokens a job burns x retry rate. List prices: Haiku 5.5 is 20x cheaper than Sonnet on input; Sonnet is half of Opus; Fable is 2.5x Opus. Every row confirmed unless the verdict says otherwise.

| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed. Anthropic lists summaries, compaction, database queries and classification as the Haiku fit; cheapest by 20x. | A (Haiku 5.5 page) |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed. Haiku FrontierCode 46.4 vs Sonnet 52.1 and Terminal-Bench 39.2 vs 70.6 support the 100k-file cap and the sonnet fallback; the 100k prompt tier is Haiku's price break. Qwen reports support the alternate; lane unprobed (router refused connection). | A (Haiku page), B (MindStudio), M (Chris 2026-10-10) |
| 3 | wiring | sonnet | Confirmed. Well-scoped everyday work is Anthropic's stated Sonnet fit; Haiku remains plausible for re-pins and settings plumbing but untested, no change proposed. | A (Sonnet page), M (2026-10-12) |
| 4 | fix | sonnet | Confirmed. Anthropic names bug fixing as Sonnet's strength; ledger shows 2 landings, 0 failures. Sonnet GDPval-AA and CursorBench within 3 points of Opus at half the price. | A (Sonnet page), B (CodeRabbit), ledger |
| 5 | refactor | sonnet | Confirmed with the standing caveat. Docs list large-scale refactoring under Opus 5.5 examples, so keep the build/test gate and the file list in the brief; opus for a brief over about 10 files with no list. | A (docs matrix), B (Creator quote), M (2026-10-12) |
| 6 | research | sonnet | Confirmed at low effort. Sonnet near Opus on GDPval-AA (1844 vs 1846) and AA-Briefcase; opus remains for recall-heavy synthesis. | A, C |
| 7 | build | sonnet (fallback opus) | Confirmed for exhaustive briefs. Base44 118 builds at 3.6 iterations, Creator: Opus sets architecture, Sonnet implements, CodeRabbit side-by-side near identical in two thirds of the time. | A (Sonnet page quotes), B (CodeRabbit) |
| 8 | design | opus | Confirmed. Anthropic: Opus 5.5 stays clearly stronger at open-ended work needing sustained judgment; docs: start with Opus 5.5 for complex systems engineering. | A |
| 9 | ui-creative | opus | Confirmed, no change. Opus 5.5 topped a graphics-and-polish game test (A, tester); Sonnet 5.5 is also credited with design sense and UI polish at half the price, so it stays a candidate for Chris to judge. | A (both pages), B (Wiegold, carried) |
| 10 | asset | opus | Not source-confirmed: no evidence on 3D modeling or spatial work for any model. Maintainer decision only; not re-dated. | M (Chris 2026-10-29) |
| 11 | forensic | opus | Confirmed. CodeRabbit hard cases: Opus 5.5 8/13 (10/13 at Max) vs Sonnet 6/13; ledger 1 landing at 43k tokens. Fable is the escalation, not the first pass. | B (CodeRabbit), ledger |
| 12 | coordination | sonnet | Maintainer decision, no source test; Creator's Opus-architects/Sonnet-implements pattern is consistent. Not re-dated. | M (Chris 2026-10-17, KIT-D098) |
| 13 | plan | opus (fallback fable) | Confirmed. Anthropic: Opus 5.5 at Fable level on most work, Fable only when Opus at xhigh or max falls short; Fable costs 2.5x Opus. | A (Opus page, docs matrix) |
| 14 | greenfield | opus | Maintainer decision (KIT-D108, DE-D057); no source test of new-system first passes. Base44 suggests Sonnet builds apps level with Opus 5, but not Opus 5.5, so no change. Not re-dated. | M (Chris 2026-10-28) |
| 15 | deep | fable (explicit only) | Confirmed. Anthropic positions Fable 5.1 for hours-long agent work and rare root-cause problems, at the highest price; explicit-only keeps it off routine work. | A (Fable page) |

## Sources
- A: https://docs.anthropic.com/en/docs/about-claude/models/overview
- A: https://docs.anthropic.com/en/docs/about-claude/models/choosing-a-model
- A: https://docs.anthropic.com/en/release-notes/overview
- A: https://www.anthropic.com/news
- A: https://www.anthropic.com/claude/fable
- A: https://www.anthropic.com/claude-opus-5-5
- A: https://www.anthropic.com/claude-sonnet-5-5
- A: https://www.anthropic.com/claude-haiku-5-5
- B: https://coderabbit.ai/blog/sonnet-5-5-model-review
- B/C: https://www.mindstudio.ai/blog/qwen3-8-27b-agentic-coding-test

## Exceptions
- No proposed family changes. All four aliases resolve (grade A lineup); a search miss on any model is a search gap, never an exception.
- asset, coordination, greenfield: maintainer decisions only, no source test; not re-dated.
- local-qwen: router refused connection at 127.0.0.1:8080; lane unprobed.
- Caveat: Anthropic's docs say "most workloads start with Opus 5.5". The table routes by cost per landing instead, since Sonnet lands well-scoped work at half the price; the ledger is too thin (3 rows) to test that yet.
