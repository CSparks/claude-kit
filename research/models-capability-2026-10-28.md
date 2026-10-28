# Models capability: weekly reassessment (2026-10-28)

Extends `models-capability-2026-10-27.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. Web content came through a summarizing search tool; spot-check numbers before citing in a decision.

## Lineup (unchanged)
- fable `claude-fable-5-1` $10/$50 (price only found: computingforgeeks; no coding benchmarks found); opus `claude-opus-5-5` $4/$20; sonnet `claude-sonnet-5-5` $2/$10; haiku `claude-haiku-5-5` $0.10/$0.50.
- local-qwen: Qwen3.8-27B, free on the V100 lane; lane not probed.
- No Claude model newer than Haiku 5.5 found (search only surfaced Opus 5 in July and an unconfirmed September rumor).

## New evidence this run
- Opus 5.5 FrontierCode 54.4%, CursorBench 57.8%; Sonnet 5.5 Terminal-Bench 4.0 70.6% vs Opus 66.4% (Opus at xhigh) (C: cometapi).
- Artificial Analysis Coding Agent Index: Sonnet 5.5 max ranks first, about 60% more output tokens per task than Opus (C: deeplearning.ai The Batch).
- Haiku 5.5: Terminal-Bench 4.0 39.2% vs Sonnet 70.6%; SWE-Bench Pro 64.8 vs 81.3; positioned for narrow tasks and subagents (C: dev.to, apidog).
- Qwen3.8-27B: M5 Max 4-bit GGUF test, decent tool calling, ~40GB at long context (B: daily.dev); Hermes framework testers fixed a multi-service Docker bug (B/C: mindstudio); vendor SWE-bench Pro 61.7, Terminal-Bench 2.1 73.0 (self-reported).

## Per-job table, ranked by cost per landing (cheapest first)
| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed: narrow bounded tasks, cheapest. | A, C |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed; Haiku SWE-Bench Pro gap supports the 100k-file-size cap and sonnet fallback; Qwen reports support the alternate. | C, B, M (Chris 2026-10-10) |
| 3 | wiring | sonnet | Confirmed. | C (inference), M |
| 4 | fix | sonnet | Confirmed: Sonnet leads Terminal-Bench and AA index at half Opus price. | C |
| 5 | refactor | sonnet | Confirmed with build/test gate and file list. | C, M |
| 6 | research | sonnet | Confirmed at low effort. | C |
| 7 | build | sonnet (fallback opus) | Confirmed for exhaustive briefs. | C |
| 8 | design | opus | Confirmed: Opus leads open-ended FrontierCode/CursorBench. | C |
| 9 | ui-creative | opus | Confirmed; no new UI evidence, Sonnet a candidate for Chris to judge. | C |
| 10 | asset | opus | Not source-confirmed: no spatial/geometry evidence. Maintainer decision only. | M (Chris 2026-10-06) |
| 11 | forensic | opus | Confirmed by prior CodeRabbit hard-case result (Opus 10/13 vs Sonnet 6/13); no new evidence. | B |
| 12 | coordination | sonnet | Maintainer decision; not re-dated. | M (Chris 2026-10-17) |
| 13 | plan | opus (fallback fable) | Confirmed: Opus for planning. | C, M |
| 14 | deep | fable (explicit only) | Alias and pricing seen; no capability evidence this run. Not re-dated. | A (prior) |

## Sources
- C: https://www.cometapi.com/claude-opus-5-5-vs-sonnet-5-5/
- C: https://www.deeplearning.ai/the-batch/claude-fills-out-its-model-family/
- C: https://dev.to/hassann/claude-haiku-55-benchmarks-4bm2
- C: https://apidog.com/blog/claude-haiku-5-5-benchmarks/
- C: https://computingforgeeks.com/claude-opus-5-5-released-features-benchmarks/
- B: https://daily.dev/posts/is-qwen3-8-27b-still-1-for-local-llms-m5-max-test--qp0wxyw4t
- C: https://www.mindstudio.ai/blog/qwen3-8-27b-agentic-coding-test
- C: https://www.orcarouter.ai/blog/claude-news-what-anthropic-shipped-in-october-2026

## Exceptions
- asset: no source evidence; not re-dated.
- coordination: maintainer decision only; not re-dated.
- deep: no capability evidence; not re-dated.
- No proposed family changes. No unresolved aliases (fable-5-1 pricing seen, benchmarks absent).
