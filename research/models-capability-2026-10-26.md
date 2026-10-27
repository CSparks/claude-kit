# Models capability: weekly reassessment (2026-10-26)

Extends `models-capability-2026-10-17.md` and `models-capability-2026-10-21.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. Web content came through a summarizing search tool; numbers need a spot-check before citing in a decision. This run's search found no model released after Haiku 5.5 (2026-10-07) and no new hands-on report; the only 2026-10 source is https://blog.memoryplugin.com/claude-new-features-october-2026/ (C, single-source lineup: Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5, matching the aliases). The local-qwen lane was not probed. The outcome ledger gave no rows to this run.

## Lineup (unchanged)
- fable `claude-fable-5-1` $10/$50; opus `claude-opus-5-5` $4/$20; sonnet `claude-sonnet-5-5` $2/$10; haiku `claude-haiku-5-5` $0.10/$0.50 to 100k prompt tokens. (A/C, from 2026-10-17)
- local-qwen: Qwen3.8-27B, free where the V100 lane runs; aggregator reports only (C).

## Per-job table, ranked by cost per landing (cheapest first)
Verdicts rest on the 2026-10-17 evidence (CodeRabbit, Wiegold, codersera, laozhang, Anthropic pages), re-checked for contradiction: none found.

| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed: Anthropic's stated Haiku fit, cheapest per token. | A, C |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed: narrow edits under 100k tokens where a test catches errors; local lane unprobed. | C, M (Chris 2026-10-10) |
| 3 | wiring | sonnet | Confirmed; Haiku plausible but untested, no change proposed. | C (inference), M |
| 4 | fix | sonnet | Confirmed: Sonnet 12/12 at under half Opus's cost. | A, B (CodeRabbit, Wiegold), C |
| 5 | refactor | sonnet | Confirmed with the caveat to keep the build/test gate and file list. | C, M |
| 6 | research | sonnet | Confirmed at low effort; opus for recall-heavy synthesis. | C |
| 7 | build | sonnet (fallback opus) | Confirmed for exhaustive briefs; never Sonnet at max effort. | A, C |
| 8 | design | opus | Confirmed: Opus leads open-ended architecture. | A, C |
| 9 | ui-creative | opus | Confirmed; Sonnet within about 30% cost and close taste, a candidate for Chris to judge. | B (Wiegold), C |
| 10 | asset | opus | Not source-confirmed: spatial and geometry work has no evidence on any model. Rests on the maintainer's decision, no new evidence. | M (Chris 2026-10-21) |
| 11 | forensic | opus | Confirmed: CodeRabbit hard cases Opus 8 vs Sonnet 6. | B |
| 12 | coordination | sonnet | Maintainer decision, no source test. | M (Chris 2026-10-17: "Planning is separate from coordination. Opus for planning, Sonnet for coordination.") |
| 13 | plan | opus (fallback fable) | Confirmed: sources say Opus by default, Fable only when Opus at max fails; Fable 2.5x Opus per token. | C, M (Chris 2026-10-21) |
| 14 | deep | fable (explicit only) | Confirmed: Anthropic positions Fable for multi-hour and rare-edge-case work. | A |

## Exceptions
- asset: no source evidence (carried); not re-dated.
- coordination: no source evidence (maintainer decision only); not re-dated.
- local-qwen: lane unprobed; targeted-change alternate rests on C sources.
- No proposed family changes. All aliases resolve to the lineup above.
