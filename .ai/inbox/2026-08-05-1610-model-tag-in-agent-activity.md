# Model in brackets in agent activity descriptions

Chris, 2026-08-05 (client-rx-clinical session): "add the model being used in brackets in
the agent activity description. Right now, it just says 'general-purpose  Build CRX-T024
admin foundation'. I'd like it to say 'general-purpose [Opus 5] Build CRX-T024 admin
foundation'" — plus follow-ups: it should also render in the kit's own surfaces (roster →
orient, kit UI), since agents are tracked at the ticket level.

Shape: PreToolUse(Task) hook prepends `[<Model Display>]` to the dispatch description via
updatedInput (verify harness contract first); resolution = explicit input.model → agent
frontmatter pin → session model (dispatch-guard.mjs ~193-240 has the resolvers); roster
rows gain `model`; orient + UI render it. Prior art: archived KIT-T034 per-ticket model
tagging.

**Status: already dispatched** to an opus builder 2026-08-05 ~16:05 UTC, briefed to cut
the KIT ticket itself. On triage: if its ticket exists, fold this into it (dedup), else
promote this to the ticket.
