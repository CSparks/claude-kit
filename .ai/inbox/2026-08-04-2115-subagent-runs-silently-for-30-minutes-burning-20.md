(feature) Dispatch cost CEILING — a subagent that blows past a token/time budget reports or halts, it does not burn silently.

CORRECTED CAPTURE: the VISIBILITY half of this complaint is ALREADY SHIPPED as
KIT-T178 (a9b5ec0, review) — PreToolUse(Bash) publishes the running build to
`.ai/agents-progress.jsonl`, orient shows "running: cargo test (6m)". Do not rebuild it.

The half T178 does NOT cover: nothing STOPS or even warns on spend. Chris killed the
HUD agent by hand at 300K tokens / 30 min, after the game-asset-artist hit 230K/30min
("That's the second fucking time that's happened and it needs to fucking stop at a
system level via Claude Kit so the knowledge is portable"). A live progress line tells
you it is running; it does not tell you it has spent three times what the task was
worth, and it does not act.

Wanted: a declared budget per dispatch (tokens and/or wall-clock), a warn threshold
that surfaces to the main thread, and a hard ceiling behaviour (halt-and-report, so
partial work is collectable rather than killed by hand). The existing knowledge is
currently PROSE only — the base CLAUDE.md "Delegation COST" rules and the SESSION.md
cost note ("the 3-ticket small batch cost 167K vs ~300K for one big-ticket pass") — i.e.
it depends on the agent remembering, which is exactly what Chris said must stop.

Links: KIT-T178 (visibility, shipped) · KIT-T177 (roster scoping) · base CLAUDE.md
"Delegation COST — scale the ceremony, isolate the checkout".
