(bug) Process failure, 2026-08-07 (gridiron-blitz GB-T091 dispatch): Chris said "Fix it
with an Opus 4.8"; orchestrator dispatched via the Agent tool alias `model: opus` (→
Opus 5), told Chris a point version "can't be pinned per-delegation", then ran an
AskUserQuestion re-litigating whether the ladder should name versions — settled the
previous day by KIT-D061 (full-id pins, alias-drift explicitly the bug, pinned-agent
mechanism documented, `opus`→Opus-5 retarget even cited). Root cause: delegation made
WITHOUT grounding in `.ai/config.yml → dispatch.tiers` / KIT-D061 first — the global
contract's own pre-dispatch step. Contributing: KIT-T209's pinned scoped/ui agents not
yet scaffolded, so the sanctioned 4.8 lane didn't exist to use (should have been
surfaced, not papered over with "impossible"). Enforcement gap: dispatch-guard checks
frontmatter pins on kit agents but nothing checks an ORCHESTRATOR dispatch against a
version named in the request/ticket — consider a dispatch-ladder hook rule: block/warn
when the active request text names a full version and the Agent call carries a bare
alias. See KIT-D063 (the binding-version rule this produced).
