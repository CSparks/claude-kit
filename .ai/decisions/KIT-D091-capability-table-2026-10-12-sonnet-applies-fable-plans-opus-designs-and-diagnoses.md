---
id: KIT-D091
title: Capability table 2026-10-12: sonnet applies, opus designs and diagnoses, fable plans; refresh needs graded per-job research
status: accepted
date: 2026-10-12
supersedes: KIT-D088 (build, deep and the staleness rule), KIT-D090 (the build line)
source: research/models-capability-2026-10-12.md; KIT-T433, KIT-T432; Chris 2026-10-12 (stiletto session, via coordinator)
---

**Decision:**
- Rows, all re-dated 2026-10-12 on the research note (graded A/B/C) plus Chris's approval (graded M where the research had only inference):
  - `fix`, `refactor`, `wiring`, `research`: sonnet. `refactor` goes to opus only for a brief over ~10 files with no file list; `research` goes to opus where synthesis or recall matters.
  - `build`: sonnet with an opus fallback. Sonnet implements an exhaustive brief (plan-then-apply). An opus build, by job or by explicit model, needs `[escalate: <reason>]` (the escalation gate now compares the explicit model's family, not only the job row's).
  - `design`: opus, ordinary design and root-cause work; it writes the plan and apply brief. `forensic`: opus (CodeRabbit's hardest cases: Opus 8, Sonnet 6). `asset`: opus, spatial work unresearched. `ui-creative`, `chore`, `targeted-change`: unchanged.
  - New `plan` job: fable, `self_escalating: true`, not explicit-only. Complicated multi-system or spatial planning (rolling terrain edges, integrating mine entrances into the surrounding terrain). A `plan` dispatch is itself the escalation: the escalation gate passes it on any ticket type, with or without `[escalate]`. `deep` stays fable and explicit-only.
- The refresh is capability research, not a price list (supersedes the D088 staleness rule):
  - `scripts/model-refresh.mjs` refuses to run, writing nothing, unless `research/models-capability-<date>.md` holds a table with `Job` and `Basis` columns grading a source (A Anthropic, B named hands-on, C aggregator, M the maintainer's quoted decision) for EVERY `dispatch.jobs` row.
  - `scripts/job-capability.mjs redate` re-dates a row only when that dated note grades it. A refresh alone re-dates nothing.
  - Staleness is judged per row: the gate and orient use the OLDEST row's evidence, and orient prints `oldest row evidence <date> (<job>, N d)`. The lineup refresh must also be within `refresh_days`.
  - The weekly housekeeping directive fires when either the lineup or the oldest row reaches `refresh_days - 1` and orders the graded note before the refresh.
- In-repo Rust trial (Sonnet vs Opus on 3-4 real tickets) recorded as KIT-T434.

**Why:** Chris 2026-10-12 approved the per-job verdicts and added: "This is correct, and on top of that fable handles the more complicated planning. For example, coming up with a plan for how to properly roll the fucking edges and make my entrances look more integrated into the surrounding terrain."

On the refresh: "I certainly ask for more recent research later than two fucking months ago, in fact I asked just a couple of days ago." and "I was very explicit that the fucking landscape changes rapidly and it needs to be fucking updated rapidly." The 2026-10-10 refresh wrote only the lineup and prices, and it cleared a gate that read the table's newest date, so the opus rows rested on a 2026-08-06 sweep while orient showed "2 d".

On build: "Here's the fucking thing, your opus buddy, can you not write prompts that are good enough for Sonnet to go fucking apply?" The research supports Sonnet 5.5 on a precise brief (Terminal-Bench 4.0: Sonnet 70.6%, Opus 66.4%; about half the cost per task) with gaps on Rust, spatial work and briefs written by a stronger model, which KIT-T434 closes.

Rejected: leaving `deep` as the only fable row (planning would need an escalate on every dispatch); an `[escalate]` on `plan` (the job names the escalation); an unchecked grade field (a row re-dates only against a note a reader can open).
