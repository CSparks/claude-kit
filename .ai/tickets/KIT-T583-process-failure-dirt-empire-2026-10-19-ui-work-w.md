---
id: KIT-T583
title: Process failure (dirt-empire 2026-10-19): UI work was briefed and built in the GAME in pixels (HUD at 1:1 on a 4K capture) instead of throug
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T17:09:42Z
updated: 2026-10-20T00:53:11Z
fixed_commit: b6dd07f
---

## Description
Process failure (dirt-empire 2026-10-19): UI work was briefed and built in the GAME in pixels (HUD at 1:1 on a 4K capture) instead of through the framework with convention over configuration, although Chris has repeatedly required that mechanisms live in the framework. Root cause: UI tasks were dispatched to generic claude-kit:patch-worker with a hand-written brief instead of the specialist claude-kit:rg-ui-engineer, and nothing in the dispatch path asks 'does the framework already own this mechanism, and is the default correct without per-screen configuration?'. Fix: (1) a dispatch guard or brief template for UI/HUD/menu/screen work that requires the rg-ui-engineer specialist (or its checklist) and a framework-first check (responsive default frame, tokens, no pixel literals); (2) a lint in the kit pre-write gate for dirt-empire-style game UI code: Val::Px / pixel literals outside the framework, ppu 1.0; (3) a standing rule that UI defaults are proportional (rg-ui UiFrame) with explicit overrides only

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-19-ui-work-w
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 17:09] (created) bug — Process failure (dirt-empire 2026-10-19): UI work was briefed and built in the GAME in pixels (HUD at 1:1 on a 4K capture) instead of throug
- [2026-10-19 17:18] (comment) @claude: 2026-10-19 correction by the dirt-empire orchestrator: the true root cause is a GROUNDING failure, not only a dispatch o (full comment #1 in ## Notes)
### comment #1 [2026-10-19 17:18] @claude
2026-10-19 correction by the dirt-empire orchestrator: the true root cause is a GROUNDING failure, not only a dispatch one. The framework already had a UI scale (rg-ui UiFit / rg-ui-bevy apply_fit, UiScale, UiTextFloor, handheld reference RG-D181). The HUD brief was written in pixels from a 1280x800 mockup without first querying the framework for an existing scale, and the orchestrator then told the maintainer as fact that the HUD 'drew at 1:1 on a 4K capture' without reading the mounted scale (ppu was 2.0). Per the global contract: ground before you propose (query the code graph, the framework contract and CHOICES.toml; assume it exists until checked), and never state a measured-looking fact about code you did not read. Fix proposals: (1) the UI specialist checklist and any UI brief template start with a 'what does the framework already provide for this (scale, tokens, frame, safe area)?' q query whose result is pasted into the brief; (2) orient surfaces the framework's ownership map for UI mechanisms for UI tickets; (3) a claim-without-receipt check in briefs: any statement about runtime behaviour must cite file:line or a measurement.
- [2026-10-19 18:09] (comment) @claude: 2026-10-19 (third recurrence same day): the hardening worker brief asked for local timing bounds, thread checks and hitc (full comment #2 in ## Notes)
### comment #2 [2026-10-19 18:09] @claude
2026-10-19 (third recurrence same day): the hardening worker brief asked for local timing bounds, thread checks and hitch measurement for livery_bake/boot_curtain although the framework already owns them: rg-work (which thread a generation step ran on, so a probe can prove the frame never generates), rg-probe-kit (hitch and span log, flat-frame detector, run HUD), rg-testkit (headless App fixtures, GPU serialisation). Briefs for game work do not include the framework's crate map. Fix: every writer brief for a dirt-empire/stiletto ticket must embed or cite rapid-game/docs/CRATES.md rows relevant to the nouns in the ticket (a generated 'framework already offers' table from q over CRATES.md and CHOICES.toml), and the dispatch guard should fail a brief that has none.
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) (1) hooks/dispatch-ui.mjs ui-framework-first dispatch check, test hooks/dispatch-ui.test.mjs 9 passed; (2) pre-write ui-pixel-literal for Val::Px in game code of a rapid-game repo, test hooks/ui-pixel-gate.test.mjs 9 passed; (3) the proportional-default rule stays in the project contract
