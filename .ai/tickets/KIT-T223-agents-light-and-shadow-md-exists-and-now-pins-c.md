---
id: KIT-T223
title: agents/light-and-shadow.md exists (and now pins claude-fable-5/medium) but is NOT a dispatchable agent type - the plugin roster exposes…
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:33.090Z
updated: 2026-08-16T00:18:22Z
---

## Description
agents/light-and-shadow.md exists (and now pins claude-fable-5/medium) but is NOT a dispatchable agent type - the plugin roster exposes only code-reviewer/game-asset-artist/refactorer/researcher/test-author. Registration gap (manifest or plugin reload); audio-synthesist likely same. Found dispatching the first asset-lane job (ST-T145).

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] Root cause of the registration gap identified
- [x] Every `agents/*.md` is exposed as a dispatchable agent type
- [x] A test asserts registration completeness both ways, with a negative control

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
Root cause: `.claude-plugin/plugin.json` carries an EXPLICIT `agents` array — it listed only researcher/code-reviewer/refactorer/test-author/game-asset-artist, so light-and-shadow.md and audio-synthesist.md shipped in the repo but were never registered. Nothing about the files themselves differed. Fix: the array now lists all seven, and `checkRegistration` in scripts/agent-pins.mjs fails both directions (an agent file absent from the manifest, and a manifest entry with no file) so the next agent added cannot be silently unreachable. Evidence: `node scripts/agent-pins.test.mjs` — 14 passed.

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-08-16 00:16] (status) todo → doing
- [2026-08-16 00:18] (status) doing → review
- [2026-08-16 00:18] (comment) Cause: plugin.json's explicit agents array omitted light-and-shadow + audio-synthesist. All 7 now registered; checkRegistration test fails both directions (agent-pins.test.mjs, 14 passed).
