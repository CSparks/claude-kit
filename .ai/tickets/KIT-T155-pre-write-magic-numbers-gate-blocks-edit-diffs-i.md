---
id: KIT-T155
title: pre-write magic-numbers gate blocks Edit diffs INSIDE claude-kit-ignore-start/end blocks

Observed 2026-07-16 in groovegrid: editing a numeric tuple line inside an
established `claude-kit-ignore-start magic-numbers` â€¦ `end` block (the
*PanelSpec.h placements arrays â€” every such file wraps them) gets BLOCKED when
applied via the Edit tool, but the identical content applied via Write
(full-file) passes. The hook evidently evaluates the Edit PAYLOAD (old/new
strings) without resolving the surrounding ignore-block scope in the target
file, so per-line context is lost. Effect: anyone editing already-excluded
lines via Edit gets a false block and is pushed toward Write-whole-file (worse
tool for the job) or adding redundant per-line markers.

Fix: pre-write.mjs must locate the edit's position in the CURRENT file text
and honor enclosing start/end markers before flagging, same as it does for
whole-file scans. Repro: any Edit changing a number inside
groovegrid/src/ui/tracks/effect-panels/ContinuumPanelSpec.h placements.
type: bug
status: doing
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: [KIT-T137]           # re-keyed 2026-08-02: KIT-T137 was already claimed by an earlier web-UI ticket
parent:                # id of the parent item (epic/request) this belongs to â€” upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds â€” reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep â€” expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku â€” pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max â€” pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-23T15:42:09.416Z
updated: 2026-08-16T00:18:09Z
---

## Description
pre-write magic-numbers gate blocks Edit diffs INSIDE claude-kit-ignore-start/end blocks

Observed 2026-07-16 in groovegrid: editing a numeric tuple line inside an
established `claude-kit-ignore-start magic-numbers` â€¦ `end` block (the
*PanelSpec.h placements arrays â€” every such file wraps them) gets BLOCKED when
applied via the Edit tool, but the identical content applied via Write
(full-file) passes. The hook evidently evaluates the Edit PAYLOAD (old/new
strings) without resolving the surrounding ignore-block scope in the target
file, so per-line context is lost. Effect: anyone editing already-excluded
lines via Edit gets a false block and is pushed toward Write-whole-file (worse
tool for the job) or adding redundant per-line markers.

Fix: pre-write.mjs must locate the edit's position in the CURRENT file text
and honor enclosing start/end markers before flagging, same as it does for
whole-file scans. Repro: any Edit changing a number inside
groovegrid/src/ui/tracks/effect-panels/ContinuumPanelSpec.h placements.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (â†’review when config.uat: required,
     â†’done when none) requires this ticket to cite a test artifact â€” a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha â€” OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] An Edit whose new_string lands inside an existing ignore-start/end block passes
- [x] The same Edit landing OUTSIDE the block still blocks (negative control)
- [x] Exclusions are evaluated against the POST-EDIT file content, not the fragment
- [x] Covered by a fixture-file test in hooks/exclusions.test.mjs

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. Reconstruct the post-edit file text once in pre-write.mjs and resolve every exclusion
   against it, mapping fragment line numbers by the splice offset.

## Notes
<!-- prose/narrative progress â€” free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
### comment #1 [2026-07-23 18:57] @chris
Maintainer challenged the 'displayName may not contain quotes or newlines' rejection (writes.mjs:101). Verdict: the quote ban is an unescaped-writer shortcut, not a real constraint â€” the line splice writes display_name: " name\ without escaping. Fix: escape backslash + double-quote on write (YAML double-quoted style), drop quotes from the rejection; KEEP the newline/CR ban (structurally required for the line-oriented splice) and the 48-char cap. Routed to the in-flight KIT-T147 writer since it edits writes.mjs anyway. --author claude

### 2026-08-16 — fixed
Root cause confirmed as described: `excludedFile`/`excludedAt` in hooks/pre-write.mjs read
markers out of the payload `content`, which on an Edit is only `new_string`. A shared
`postEdit()` now reconstructs the resulting file (reusing the file-length reconstruction
from KIT-T121/T211 — one implementation, not two) and returns `{ text, offset }`; markers
are read from `text`, and a fragment line N is tested at `offset + N`. `offset` is null
(no mapping, fragment-local markers only) when the fragment cannot be placed
unambiguously: a stale old_string, or a replace_all hitting several sites. Every other
check stays fragment-scoped, so an Edit is still never blocked on pre-existing violations
elsewhere in the file.

Evidence: hooks/exclusions.test.mjs §8 — fixture .h file with a placements array wrapped
in an ignore block; the Edit inside passes, the Edit outside still exits 2. Full suite
green (`npm test`; the trailing server/server.test.mjs failure is a pre-existing missing
`express` dependency in this worktree, unrelated).

## History
<!-- structured event log â€” APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo â†’ doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen â€” cross-cut ones also go in DECISIONS.md
       (blocker)   <title> â€” open          (unblocked) <title> â€” <resolution>
       (fixed)     <sha>                    (regressed) â†’ T-040   (recurred as)
     NEVER edit or delete a prior line â€” this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-07-23 18:57] (comment) @chris: Maintainer challenged the 'displayName may not contain quotes or newlines' rejection (writes.mjs:101). Verdict: the quot (full comment #1 in ## Notes)
- [2026-08-16 00:18] (status) todo → doing
