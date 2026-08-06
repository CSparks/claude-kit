# Model routing ladder — evidence base (2026-08-06, KIT-T208)

Distilled from a community-takes web sweep (researcher agent, 53 tool calls) plus a
claude-code-guide mechanics check and the claude-api skill's model catalog. Source tiers:
A = Anthropic docs, B = named-practitioner hands-on, C = aggregator/SEO (anecdote laundering
— ~60% of the genre; cost-savings percentages there are mutually contradictory and unreliable).

## Lineup facts (A-tier)

| Model | $/MTok in/out | Effort levels | Retires (not sooner than) |
|---|---|---|---|
| claude-fable-5 | 10 / 50 | low..max (always-on thinking) | 2027-06-09 |
| claude-opus-5 | 5 / 25 | low..max | 2027-07-24 |
| claude-opus-4-8 | 5 / 25 | low..max | 2027-05-28 |
| claude-opus-4-7 | 5 / 25 | low..max | 2027-04-16 |
| claude-opus-4-6 | 5 / 25 | low/med/high/max (NO xhigh) | 2027-02-05 |
| claude-sonnet-5 | 3 / 15 ($2/$10 intro → 2026-08-31) | low..max | 2027-06-30 |
| claude-sonnet-4-6 | 3 / 15 | low/med/high/max | 2027-02-17 |
| claude-haiku-4-5 | 1 / 5 | NONE (effort param unsupported) | **2026-10-15** (nearest risk) |

Opus 4.1 retired 2026-08-05. The whole Opus 4.x line costs the SAME as Opus 5 — older Opus
is a behavior play, never a savings play. Real savings: Haiku, then Sonnet (but see tokenizer).

## Per-model roles (consensus, with dissent flagged)

- **Fable 5** — orchestrator/planner, last-resort escalation, best raw prose. Lower efforts
  on Fable often exceed prior models' xhigh (A). Coding vs Opus 5 genuinely contested
  (Composio: Fable wins and is MORE token-efficient; Theo/claudefa.st: Opus 5 more often
  correct). Hazards: 2x price; 30-day retention (no ZDR); Max-plan cap 50% of weekly pool.
- **Opus 5** — default hard agentic coding, review/bug-finding (accuracy holds at LOW effort, A).
  Dominant complaints: verbosity, scope creep, over-delegation (A-confirmed). Inverse-effort
  finding (B, Zvi + Reddit-discovered): performs BETTER at medium/high than max — "use low and
  medium liberally" (A). Excellent diagnoser; contested implementer vs 4.8 on small scoped tasks.
- **Opus 4.8** — the RELIABILITY ROLLBACK: strongest community signal is devs moving back to
  4.8 when Opus 5 over-scopes; better instruction adherence on small scoped tasks (HN 49079191).
  Also top sourced WRITING scores (79.6 Every.to, beats Sonnet 4.6/GPT-5.5) — but effort-hungry:
  "at medium, quality degrades significantly" (B); Anthropic says start coding at xhigh (A).
  NOTE: no direct 4.8-vs-Opus-5 prose comparison exists anywhere — "4.8 weaker than Opus 5 at
  creative" is an unsourced assertion either way.
- **Opus 4.7** — NO independent role. Strictly dominated by 4.8 (same price, worse benches,
  same effort profile, fast mode removed). Drop.
- **Opus 4.6** — thin/contradictory evidence; "4.6 for straightforward fixes" NOT supported by
  any source. It respects low/medium effort LESS strictly than 4.7+ (A), lacks xhigh, same
  price. If the goal is instruction-tight small fixes, the evidence names 4.8; if cheap, Haiku.
- **Sonnet 5** — blog-consensus "default implementer" UNDERCUT by measured tokenizer inflation:
  Microsoft measured 3.7x cost vs Sonnet 4.6 on real upgrades, 12x median tokens on architecture
  tasks; ~41% more input tokens (B). HN: Opus at low effort outperforms Sonnet at comparable or
  lower cost → independent corroboration of KIT-D043 (sonnet off the coding ladder).
- **Sonnet 4.6** — niche: assisted-dev CONTROL (vs full autonomy) and budget prose. Anthropic:
  set effort explicitly, medium recommended (A).
- **Haiku 4.5** — UNANIMOUS: subagent fan-out, search/grep, triage, summarization, mechanical
  edits. Claude Code's own Explore agent defaults to Haiku (A). No effort param — inert.

## Effort ladder (A-tier, model-SPECIFIC — "the scale is adjusted separately for each model")

- low: subagents, speed/cost-first (Anthropic names subagents explicitly).
- medium: everyday agentic balance; the Reddit fix for Opus 5 verbosity; ≈ Sonnet 4.6@high on Sonnet 5.
- high: default; complex reasoning. Raise effort when Claude "skipped a file / didn't run tests /
  didn't double-check" — upgrade MODEL when it lacked capability.
- xhigh: 30-min+ agentic runs, architecture, multi-file migrations, unclear-root-cause debugging.
  Start-here for CODING on 4.7/4.8. Not on 4.6.
- max: frontier problems only; Anthropic itself warns of overthinking + small gains.

Effort is NOT portable across generations: a fallback that changes model must re-derive effort
(4.8@medium is degraded; Opus 5@medium is fine). Changing effort mid-conversation invalidates
prompt cache — vary it across delegations, never within one. xhigh/max need max_tokens ≥ 64K.

## Rate limits — correction

API billing: Opus 5 has its own rate-limit bucket separate from the combined Opus 4.x pool
(claude-api skill, A). Subscription (Max) plans: pools are per-FAMILY (Opus vs Sonnet), no
per-version pools — do NOT build a ladder rule on "run 4.6 to spare the Opus 5 quota" there.

## Claude Code pinning mechanics (claude-code-guide, doc-sourced)

- Agent frontmatter `model:` accepts FULL versioned IDs (claude-opus-4-8) — the only true pin.
  Aliases retarget over time: `opus` silently moved 4.8 → Opus 5 at v2.1.219.
- The Agent tool's per-invocation `model` param OVERRIDES frontmatter but is alias-only in
  current builds → versioned routing lives in frontmatter; orchestrator omits the param when
  dispatching to pinned agents.
- Effort falls back silently to the highest supported level (xhigh→high on 4.6; inert on Haiku).
- `CLAUDE_CODE_SUBAGENT_MODEL` env overrides EVERYTHING — flattens the ladder if set (doctor
  check captured 2026-08-06-1627).

## Ladder implications adopted into KIT-D061 (see decision for the chosen shape)

1. KIT-D060 (Opus 5 dispatches at lower effort) is A-tier-backed; cite the effort doc.
2. Drop 4.6/4.7 from consideration; 4.8 is the sanctioned "instruction-tight scoped work +
   creative" older version.
3. Deep-tier fallback must re-derive effort per target model, not carry the tier's effort.

Primary sources: platform.claude.com/docs/en/build-with-claude/effort ·
…/prompting-claude-opus-5 · …/about-claude/model-deprecations · code.claude.com/docs/en/model-config ·
claude.com/blog/claude-model-and-effort-level-in-claude-code · anthropic.com/news/claude-opus-4-8 ·
HN 49079191, 48736605 · thezvi.substack.com/p/claude-opus-5-is-highly-capable-but ·
developer.microsoft.com/blog/not-all-model-upgrades-are-upgrades · every.to/vibe-check/opus-4-8-vibecheck ·
composio.dev/content/opus-vs-fable · usenoren.ai/blog/claude-fable-5-writing-test
