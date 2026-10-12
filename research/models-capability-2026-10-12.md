# Models capability: Sonnet 5.5 vs Opus 5.5 (2026-10-12)

Sonnet researcher agent, 2026-10-12. Grades: A = Anthropic, B = named hands-on, C = aggregator. This extends `model-routing-ladder-2026-08.md`, which covers Sonnet 5 / Opus 5 only. All web content came through a summarizing fetch tool, so exact numbers need a spot-check before they are cited in a decision.

## Bottom line
- **Applying a brief:** the evidence is indirect, but it supports Sonnet 5.5 applying a precise, well-scoped brief. No source tests Rust or briefs written by a stronger model; that part is inference.
- **Where it falls short:**
  - hard review and judgment calls
  - factual recall
  - test data: it fabricates expected values
  - one missed import in a 12-file refactor
  - Max effort underperforms Xhigh (Anthropic)
- **Cost:** Sonnet 5.5 costs about half as much per task as Opus 5.5 (51% and 54% less in two hands-on tests).

## Claims

### Lineup and price
- Sonnet 5.5 is $2/$10 per MTok and is claimed to use up to 30% fewer tokens per task than Sonnet 5. Cache reads are $0.10/MTok. https://www.anthropic.com/claude-sonnet-5-5 (A)
- Opus 5.5 is $4/$20. https://emergent.sh/learn/claude-sonnet-5-5-benchmarks (C)
- The ladder doc's prices are stale for the 5.5 generation.

### Benchmarks
- Terminal-Bench 4.0: Sonnet 5.5 70.6% vs Opus 5.5 66.4% (Sonnet 5: 10.3%). Sonnet from https://www.anthropic.com/claude-sonnet-5-5 (A); Opus from https://the-decoder.com/anthropics-claude-sonnet-5-5-nearly-matches-opus-5-5-on-benchmarks-while-costing-up-to-30-percent-less-per-task/ (C)
- GDPval-AA: Sonnet 1844 vs Opus 1846. (A)
- AA-Omniscience factual recall: Sonnet 54% vs Opus 66%. (C, emergent.sh)
- Opus keeps the edge on merge-ready code, IDE refactors and computer use. https://www.datacamp.com/blog/claude-sonnet-5-5 (C)
- A Sonnet SWE-bench Verified score of 62.8% appeared, but it looks inconsistent with the Terminal-Bench result. Uncertain.

### Effort
- On FrontierCode, Sonnet 5.5 at Max scores worse than at Xhigh. At Max it triggers code review more often, which causes timeouts and out-of-scope changes. (A, via the-decoder)
- Never run Sonnet at Max effort.

### Cost per task
- CodeRabbit reviews: $0.46 vs $1.16 per review against Sonnet 5, with about one-sixth the thinking tokens. https://www.coderabbit.ai/blog/sonnet-5-5-model-review (B/C)
- Effort drives cost: $0.41 per task at Low vs $7.60 at Max. (C, emergent.sh)
- Wiegold, chess engine in Go: $0.74 on Sonnet vs $1.52 on Opus, with equal correctness. https://thomas-wiegold.com/blog/claude-sonnet-5-5-review/ (B)
- One roundup claims a 54% saving against Opus 5.5. (C, unverified)

### Reliability
- Sonnet filled in test data from memory, so two tests failed on fabricated expected values. (B, Wiegold) Briefs must state expected values literally.
- wmedia.es monorepo test (C, unverified):
  - Sonnet passed 11/20 runs, Opus 13/20.
  - Sonnet never broke a test that was already passing.
  - On a 12-file refactor, Opus caught a missing import that Sonnet missed.
- CodeRabbit's 13 hardest cases: Sonnet found 6, Opus found 8. (B/C)
- C-source consensus:
  - Opus suits ambiguous, architectural and judgment work.
  - Sonnet suits scoped bug fixes and clear-spec implementation.

### Gaps
Nothing tests:
- Rust
- spatial or geometry work
- large-context degradation on 5.5
- briefs written by a stronger model

### Haiku 5.5 (released 2026-10-07)
- First Haiku with effort levels.
- Terminal-Bench 4.0: 39.2%, vs Sonnet 5.5 at 70.6%.
- SWE-bench Multilingual: 83.7%.
- Fits small, specific edits.
- The reported price of $0.10/$0.50 needs verification.
- Haiku 4.5 retires on 2026-10-15.

## Proposed verdicts per job (proposals; Chris approves table changes)
| Job | Verdict | Basis |
|---|---|---|
| fix | Sonnet 5.5, medium or high effort; Haiku 5.5 for single-site mechanical edits | A, B |
| refactor | Sonnet 5.5 with a precise brief, plus a build/test gate; Opus for briefs over ~10 files or with no file list | C (unverified), inference |
| wiring | Sonnet 5.5 (Haiku plausible, untested) | inference |
| research | Sonnet 5.5 to gather; Opus 5.5 where synthesis or recall matters | C |
| build | Opus 5.5 when the spec is open-ended or long-horizon; Sonnet 5.5 when the brief is exhaustive (the plan-then-apply rule) | A, C |
| design | Opus 5.5 | A, C |
| ui-creative | Sonnet 5.5 viable; Chris judges | B (one test) |
| asset | Opus 5.5 (spatial work is unresearched) | none |
| forensic | Opus 5.5 | B/C |

## Caveats
- KIT-D043 ("sonnet off the coding ladder") rested on Sonnet 5's token inflation. The 5.5 generation reverses that, so the decision needs revisiting.
- To close the gaps, run an in-repo trial: 3–4 real Rust briefs on Sonnet 5.5 vs Opus 5.5 at medium effort, comparing pass rate and tokens.
