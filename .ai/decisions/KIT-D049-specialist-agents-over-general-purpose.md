---
id: KIT-D049
title: Never dispatch general-purpose when a specialist would fit — create the specialist
type: decision
status: accepted
decided: 2026-08-03
decided_by: Chris
links: [KIT-D035, KIT-D042, KIT-D043, KIT-T151, KIT-D048]
---

## Decision
`general-purpose` is the **fallback of last resort**, not the default. Before every
delegation, two questions get answered explicitly:

1. **What thinking level does this need?** Pick `model` AND `effort` deliberately from
   the firepower ladder. Never inherit by accident.
2. **Is there an agent one level more specific than "general"?** If a kit agent covers
   the domain, use it. If none does, **create it in `claude-kit/agents/` and then
   dispatch to it.**

A domain that has come up twice has earned an agent. The second time the same brief
preamble gets hand-written into a `general-purpose` prompt IS the signal.

Chris, 2026-08-03: *"You should always consider the thinking level need and use specific
agents. If we don't have one that is one level more specific for a general task that
should have a specialist, create it in Claude Kit and use it. That needs to be the rule
enforced in the Claude Kit prompt."*

## Why
Over one long session on a game repo, every single delegation went to `general-purpose`
with a long hand-written brief — shadows and lighting seven times, procedural audio four
times — while `game-asset-artist` sat unused in the kit. Each brief re-derived the same
domain rules from scratch (you cannot see, validate numerically, one light source, keep
the negative control), and each one trimmed a slightly different subset, so hard-won
gotchas were re-learned instead of inherited.

**A long hand-written brief to `general-purpose` is a specialist agent that was never
written down.** The agent file is where a domain's conventions and its accumulated
scar tissue live, so the next dispatch starts from what was already learned rather than
from whatever the main thread happened to remember that turn.

## Created under this decision
- `agents/audio-synthesist.md` — procedural audio; carries the "two pure tones read as
  consumer electronics" rule, the negative-control habit, the phantom-test-waveform trap,
  and the geometric-bin tonality bias.
- `agents/light-and-shadow.md` — lighting/shadow/pass ordering; carries the one-light
  rule, closed-form-over-discretisation, opaque-mask compositing, shadow attachment,
  layer-as-a-property, and the golden-record blast-radius guard.

## Consequences
- Kit agents stay **cross-project**: they live in `claude-kit/agents/` and every adopted
  repo gets them. Project-local one-offs still go to `<repo>/.claude/agents/` via
  `scaffold-agent`, but the kit is preferred when the domain generalises.
- New agents pin `model:` in frontmatter (KIT-T151) so a delegation never silently
  inherits an expensive main-thread model.
- Writing the agent has a real cost, paid once, against a brief re-typed every dispatch.
  When in doubt after the second occurrence, write it.
- Candidate for hook enforcement: warn on an `Agent` call with
  `subagent_type: general-purpose` whose prompt exceeds some length — a long brief is
  the tell that a specialist is missing. Not built; recorded so it is not re-derived.
