# Models capability: weekly reassessment (2026-11-25)

Extends `models-capability-2026-11-18.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. This run gathered no new web source: the stale-table gate (KIT-T339) blocked every dispatch, and the maintainer answered the check directly with his ranking of the current lineup (KIT-D179, 2026-11-25): "Best Fable 5.2, Better Opus 5.5, Good Sonnet 5.5, Lite Haiku 5.5". That ranking matches `.ai/model-lineup.json` and the 2026-11-18 table, so no family moves and every row is re-dated on it.

## Lineup (grade M, KIT-D179; grade A carried from 2026-11-18)
- fable `claude-fable-5-2` $8/$40 per MTok: best.
- opus `claude-opus-5-5` $4/$20: better.
- sonnet `claude-sonnet-5-5` $2/$10: good.
- haiku `claude-haiku-5-5` from $0.10/$0.50: lite.
- No newer model named; `dispatch.aliases` unchanged.

## Per-job table, ranked by cost per landing (cheapest first)

| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed. Lineup and price unchanged. | M (KIT-D179, 2026-11-25), A (models overview 2026-11-18) |
| 1 | run-monitor | haiku | Confirmed. | M (KIT-D179, 2026-11-25; KIT-D171) |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed. | M (KIT-D179, 2026-11-25), A (Haiku page) |
| 3 | wiring | sonnet | Confirmed. | M (KIT-D179, 2026-11-25), A (Sonnet page) |
| 4 | fix | sonnet | Confirmed. | M (KIT-D179, 2026-11-25), ledger 2026-11-18 |
| 5 | refactor | sonnet | Confirmed with the standing caveat. | M (KIT-D179, 2026-11-25), A (docs matrix) |
| 6 | research | sonnet | Confirmed at low effort. | M (KIT-D179, 2026-11-25), ledger 2026-11-18 |
| 7 | build | sonnet (fallback opus) | Confirmed for exhaustive briefs. | M (KIT-D179, 2026-11-25), A (Sonnet page) |
| 8 | design | opus | Confirmed. | M (KIT-D179, 2026-11-25), A (models overview 2026-11-18) |
| 9 | ui-creative | opus | Confirmed. | M (KIT-D179, 2026-11-25) |
| 10 | asset | opus | Maintainer decision stands. | M (KIT-D179, 2026-11-25; Chris 2026-10-29) |
| 11 | forensic | opus | Confirmed. | M (KIT-D179, 2026-11-25), B (CodeRabbit) |
| 12 | coordination | sonnet | Maintainer decision stands. | M (KIT-D179, 2026-11-25; KIT-D098) |
| 13 | plan | opus (fallback fable) | Confirmed. | M (KIT-D179, 2026-11-25), A (models overview 2026-11-18) |
| 14 | greenfield | opus | Maintainer decision stands. | M (KIT-D179, 2026-11-25; KIT-D108) |
| 15 | deep | fable (explicit only) | Confirmed; fable is the best model. | M (KIT-D179, 2026-11-25) |

## Sources
- M: KIT-D179 (Chris 2026-11-25)
- A: https://platform.claude.com/docs/en/models/overview (fetched 2026-11-18, carried)
- Carried B and C sources: see `models-capability-2026-11-18.md`

## Exceptions
- No web source was fetched this week; a run with web search should still look for a Fable 5.2 against Opus 5.5 comparison.
- local-qwen: lane unprobed.
