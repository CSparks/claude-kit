# Models capability: weekly reassessment (2026-10-17)

Weekly reassessment, extends `models-capability-2026-10-12.md`. Grades: A = Anthropic, B = named hands-on, C = aggregator, M = maintainer's quoted decision. All web content came through a summarizing fetch tool, so exact numbers need a spot-check before they are cited in a decision. The outcome ledger holds no rows (`dispatch-report.mjs`: "no dispatch outcomes recorded"), so no row rests on our own landings yet.

## Lineup
- Fable 5.1 (`claude-fable-5-1`, 2026-09-01): $10/$50 per MTok, cache reads $0.25. https://www.anthropic.com/claude/fable (A)
- Opus 5.5 (`claude-opus-5-5`): $4/$20. Sonnet 5.5 (`claude-sonnet-5-5`): $2/$10, 70.6% Terminal-Bench 4.0. https://www.anthropic.com/claude-sonnet-5-5 (A)
- Haiku 5.5 (`claude-haiku-5-5`, 2026-10-07): $0.10/$0.50 up to 100k prompt tokens, $0.50/$2.50 above. Haiku 4.5 ($1/$5) retired 2026-10-15; the alias already points at 5.5. https://metricnexus.ai/blog/claude-haiku-5-5-benchmarks-pricing (C)
- local-qwen: Qwen3.8-27B (2026-08-14, Apache 2.0, 262k context). The router at 127.0.0.1:8080/v1 gave no answer to `curl` this run, so the lane was not probed. https://codersera.com/blog/qwen-3-8-27b-local-claude-code-replacement-2026/ (C)
- No new Anthropic model since 2026-10-07. Press talk of an unnamed model before the IPO is unconfirmed (C).

## New evidence since 2026-10-12
- **Sonnet vs Opus, cost:** 12 Claude Code runs cost $0.88 on Sonnet 5.5 vs $1.91 on Opus 5.5, Sonnet passing 12/12 at 13 s median vs 22 s. (B/C roundup of wmedia.es) Artificial Analysis puts Sonnet at roughly 60% more output tokens, so realistic savings are 16% to 48%, and at max effort Opus is cheaper ($5.98 vs $7.67 per task). https://codersera.com/blog/claude-sonnet-5-5-vs-opus-5-5-2026/ (C)
- **Sonnet vs Opus, review:** CodeRabbit 13 hard cases: Sonnet 6, Opus 8, Opus at max 10. Sonnet fits routine PR review, Opus stays for high-risk changes. https://coderabbit.ai/blog/sonnet-5-5-model-review (B)
- **Sonnet vs Opus, UI:** Opus came out on top in web-design tests; Sonnet came close at about 30% less money with near-equal design taste. https://thomas-wiegold.com/blog/claude-sonnet-5-5-review/ (B)
- **Haiku 5.5:** Terminal-Bench 4.0 39.2% vs Sonnet 70.6%; AA-Omniscience factual recall 4 vs 20 (hallucinates facts); tokenizer emits about 30% more tokens than Haiku 4.5; Artificial Analysis cost $0.12 per task at xhigh. Anthropic positions it for narrowly scoped jobs (compaction, summarization, subagent work). Haiku-first with escalate-on-failure beats Sonnet-only once Haiku passes about 10% of tasks, but only where a test, type check or validator catches its errors. https://blog.laozhang.ai/en/posts/claude-haiku-5-5-vs-sonnet-5-5 (C); https://benchlm.ai/compare/claude-haiku-5-5-vs-claude-sonnet-5-5 (C)
- **Fable 5.1 vs Opus 5.5:** Anthropic says Opus 5.5 performs at Fable 5.1's level on most work at 60% less per token. Terminal-Bench 4.0 Opus 66.4% vs Fable 55.8%; GDPval-AA Opus 1846 vs Fable 1735. Advice in the sources: Opus 5.5 by default, Fable only where Opus at max effort still fails. https://blog.laozhang.ai/en/posts/claude-fable-5-1-vs-opus-5-5 (C); https://christopheralarcon.com/blog/claude-opus-5-5-vs-fable/ (C)
- **Fable 5.1 strengths:** root-cause fixes, rare edge cases, multi-hour agent tasks; a financial firm reports it fixed a one-in-a-million crash Fable 5 missed. https://www.anthropic.com/claude/fable (A, customer quote)
- **Fable cost in an orchestrated build:** Fable 5 cost about $500 in half a day; Fable 5.1 about $1,200 in 1.5 days, routing 57% of the work to Opus workers. The review scored 9.1 vs 8.4, and the builder judged the extra $700 unjustified. https://www.mindstudio.ai/blog/claude-fable-5-vs-5-1-app-build-comparison (B)
- **Conflict, unreconciled:** Fable 5.1 Terminal-Bench 4.0 appears as 85.02% (search summary of vals.ai/CometAPI, C) and as 55.8% (Vellum, laozhang, C). The 55.8% figure matches two sources and the Opus comparison; the 85% figure is not used.
- **Qwen3.8-27B:** vendor SWE-bench Pro 61.7 compares a re-run "refined" set against Opus 4.6 Max's official number, so it is compromised. Independent AA index 33.7. It overthinks at default effort (21 min for a simple SVG request); medium effort plus a reasoning-token cap fixes it. One production report claims 99% agent-task completion. (C)

## Per-job table, ranked by cost per landing (cheapest first)
Cost per landing = per-token price x the tokens a job type burns x the retry rate. With no ledger rows the ranking uses list price and the hands-on cost ratios above. Every row is confirmed unless the verdict says otherwise.

| Rank | Job | Table family | Verdict | Basis |
|---|---|---|---|---|
| 1 | chore | haiku | Confirmed. Search, triage and mechanical edits are Anthropic's stated Haiku fit; 20x cheaper than Sonnet per token. | A (positioning), C (price, benchmarks) |
| 2 | targeted-change | haiku (alt local-qwen, fallback sonnet) | Confirmed. Haiku fits narrow edits where a test catches errors; the 100k-token rule matches Haiku's price jump above 100k. Local lane not probed (router silent). | C (laozhang, benchlm), M (Chris 2026-10-10 quote in the table source) |
| 3 | wiring | sonnet | Confirmed. Haiku looks plausible for re-pins and settings plumbing but is untested here; no change proposed. | C (inference), M (2026-10-12 approval) |
| 4 | fix | sonnet | Confirmed. Sonnet is Anthropic's stated fit for well-scoped fixes; 12/12 passes at under half Opus's cost; escalate on a miss. | A, B (Wiegold, CodeRabbit), C |
| 5 | refactor | sonnet | Confirmed with the known caveat: Opus caught a missing import in a 12-file refactor, so keep the build/test gate and the file list in the brief. | C (unverified), M (2026-10-12 approval) |
| 6 | research | sonnet | Confirmed at low effort. Sonnet's RAG hallucination rate is lower (47% vs 59%) but factual recall trails Opus (54% vs 66%), so synthesis from memory goes to opus. | C |
| 7 | build | sonnet (fallback opus) | Confirmed. Sonnet applies an exhaustive brief; Opus keeps open-ended builds. Never Sonnet at max effort (A, 2026-10-12). | A, C |
| 8 | design | opus | Confirmed. Opus leads open-ended engineering and architecture; at max effort Opus can cost less than Sonnet per task. | A, C |
| 9 | ui-creative | opus | Confirmed. A second test has Opus ahead with Sonnet within about 30% cost and close taste; Sonnet stays a candidate, and Chris judges. | B (Wiegold), C (uxplanet summary) |
| 10 | asset | opus | Confirmed on the maintainer's decision only. Spatial and geometry work has no source evidence on any model; not re-dated. | M (2026-10-12 approval); no source evidence |
| 11 | forensic | opus | Confirmed. CodeRabbit hard cases: Opus 8 vs Sonnet 6; Opus at max 10. Fable 5.1 is the escalation, not the first pass. | B (CodeRabbit) |
| 12 | plan | fable | NOT confirmed by sources: every source says Opus 5.5 by default and Fable only when Opus at max fails; Fable 5.1 costs 2.5x Opus per token and an orchestrated build cost 2.4x its predecessor. Row rests on Chris's 2026-10-12 decision (rolling terrain edges, mine entrances). Proposal: plan family fable to opus with fable as `fallback`. Not applied; not re-dated. | C (opus-default advice), M (2026-10-12 approval) |
| 13 | deep | fable (explicit only) | Confirmed. Explicit-only keeps the highest-cost family off routine work; Anthropic positions Fable for multi-hour ambitious work and rare edge cases. | A |
| 14 | coordination | sonnet | Maintainer decision, no source test: planning and coordination are separate jobs, so the main thread coordinates on Sonnet while `plan` stays Opus. | M (Chris 2026-10-17, KIT-D098) |

## Caveats
- The Fable-vs-Opus advice comes from aggregators plus one hands-on build; no source tests planning of the kind Chris named (spatial, terrain). That gap is why the `plan` row is a proposal, not a change.
- local-qwen rests on aggregator reports and a compromised vendor number; run an in-repo probe once the router is up.
- Nothing tests Rust or geometry on any model (carried from 2026-10-12).
