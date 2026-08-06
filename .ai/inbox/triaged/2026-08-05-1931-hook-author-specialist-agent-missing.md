# hook-author specialist agent missing from the kit

Dispatching KIT-T182 (context7 ledger hook, 2026-08-05) required a long
hand-written brief to general-purpose — per the contract, that IS a specialist
never written down. Hook authoring recurs constantly (hooks/ has a dozen+
portable Node hooks) and has stable conventions worth encoding once:
payload-read-robustly + fail-open, opt-in-aware vs machine-global scoping,
never bash, test conventions (scripts/*.test.mjs / test-hooks.mjs), wiring +
plugin version bump, exclusion-surface footers (check-id + both surfaces).

Fix: agents/hook-author.md in the kit — model pinned opus, tools scoped,
conventions + gotchas above written in. (KIT-D049 specialists-over-general.)
