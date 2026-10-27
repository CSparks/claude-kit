# Models capability: weekly reassessment (2026-10-27)

Extends `models-capability-2026-10-26.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. Web content came through a summarizing search tool; spot-check numbers before citing in a decision. No model released after Haiku 5.5 (2026-10-07) was found. Search could not confirm Fable 5.1 by name (aggregators cover Opus/Sonnet/Haiku 5.5 only); alias kept from prior runs.

## Lineup (unchanged)
- fable `claude-fable-5-1` $10/$50; opus `claude-opus-5-5` $4/$20; sonnet `claude-sonnet-5-5` $2/$10; haiku `claude-haiku-5-5` $0.10/$0.50.
- local-qwen: Qwen3.8-27B, free on the V100 lane. New C evidence: vendor-reported Terminal-Bench 2.1 73.0, SWE-bench Pro 61.7 (Claude Code harness), Artificial Analysis index 52; two hands-on agent-framework reports of zero failed tool calls over multi-hour sessions (codersera, mindstudio, orcarouter; C). Independent evaluation still thin. Lane not probed locally.

## New evidence this run
- developersdigest / codersera / uxplanet (C): Sonnet 5.5 Terminal-Bench 4.0 70.6% vs Opus 66.4% at half the price (effort levels not like-for-like); CursorBench gap about 2.3 points; Opus leads open-ended work (FrontierCode); Haiku 5.5 for bounded steps and subagents.
- CodeRabbit (B): Sonnet 6/13, Opus max 10/13 on hard review cases. Small sample.
- Claude Code `opusplan` pattern: Opus plans, Sonnet generates (C), matching the plan/coordination split.

## Per-job table, ranked by cost per landing (cheapest first)
| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed: bounded steps, cheapest. | A, C |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed; Qwen3.8 reports support the alternate, lane unprobed. | C, M (Chris 2026-10-10) |
| 3 | wiring | sonnet | Confirmed; no change proposed. | C (inference), M |
| 4 | fix | sonnet | Confirmed: Sonnet leads Terminal-Bench at half Opus cost. | B, C |
| 5 | refactor | sonnet | Confirmed with build/test gate and file list. | C, M |
| 6 | research | sonnet | Confirmed at low effort; opus for recall-heavy synthesis. | C |
| 7 | build | sonnet (fallback opus) | Confirmed for exhaustive briefs. | A, C |
| 8 | design | opus | Confirmed: Opus leads open-ended architecture. | A, C |
| 9 | ui-creative | opus | Confirmed; Sonnet a candidate for Chris to judge. | B, C |
| 10 | asset | opus | Not source-confirmed: no evidence on spatial/geometry work. Maintainer decision only. | M (Chris 2026-10-21) |
| 11 | forensic | opus | Confirmed: CodeRabbit hard cases Opus 10/13 vs Sonnet 6/13. | B |
| 12 | coordination | sonnet | Maintainer decision; opusplan pattern is consistent (C). | M (Chris 2026-10-17) |
| 13 | plan | opus (fallback fable) | Confirmed: Opus for planning; Fable 2.5x Opus per token. | C, M |
| 14 | deep | fable (explicit only) | Confirmed: Anthropic positions Fable for frontier work; alias unverified this run. | A |

## Exceptions
- asset: no source evidence; not re-dated.
- coordination: maintainer decision only; not re-dated.
- Fable 5.1 not confirmed by this run's search; alias unchanged.
- No proposed family changes.
