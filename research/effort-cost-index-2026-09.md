# Effort cost index (Anthropic, relayed 2026-09-18)

Relative cost of each effort level per model, indexed to that model's `high` = 1.00.
Source: table released by Anthropic, relayed by Chris 2026-09-18 (primary URL not captured).
The index compares efforts WITHIN a model — it says nothing about one model's price against
another's; combine with per-token pricing (research/model-routing-ladder-2026-08.md) for that.

| model | low | medium | high | xhigh | max | xhigh -> max |
|---|---|---|---|---|---|---|
| sonnet-5 | 0.47 | 0.74 | 1 | 2.41 | 5.59 | +132% |
| opus-4-8 | 0.72 | 0.90 | 1 | 1.65 | 1.88 | +14% |
| opus-5 | 0.67 | 0.76 | 1 | 1.60 | 1.70 | +6% |
| fable-5 | 0.60 | 0.77 | 1 | 1.74 | 1.91 | +10% |

## Derived steps (computed from the table)

| model | low -> medium | medium -> high | high -> xhigh |
|---|---|---|---|
| sonnet-5 | +57% | +35% | +141% |
| opus-4-8 | +25% | +11% | +65% |
| opus-5 | +13% | +32% | +60% |
| fable-5 | +28% | +30% | +74% |

## Reading it for the dispatch ladder

- **Opus 5 low -> medium is the cheapest step in the lineup (+13%).** `careful` (medium) costs
  little over `standard` (low); the expensive Opus 5 step is medium -> high (+32%).
- **Opus 5 xhigh -> max is nearly free (+6%)**; the jump that costs is high -> xhigh (+60%).
  The forensic fallback (opus-5/xhigh) pays that jump.
- **Fable 5 medium is 0.77 of high** — the asset and forensic tiers (fable/medium) save 23%
  against `deep` (fable/high).
- **Sonnet 5 effort is steep at the top** (max = 5.59x high). Compounds the tokenizer-inflation
  case that keeps sonnet off the coding ladder (KIT-D043).
- Opus 4.8's flat curve (low = 0.72, medium = 0.90) matches the KB note that 4.8 is
  effort-hungry: lowering its effort saved little. Off the ladder since KIT-D072.
