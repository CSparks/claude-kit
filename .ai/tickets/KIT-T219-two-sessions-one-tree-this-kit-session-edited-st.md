---
id: KIT-T219
title: Two sessions, one tree: this kit session edited stiletto lamp.rs while a LIVE stiletto session was committing (315e31f 10:59 scooped my…
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
created: 2026-08-16T00:06:31.379Z
updated: 2026-08-16T00:40:04Z
---

## Description
Two sessions, one tree: this kit session edited stiletto lamp.rs while a LIVE stiletto session was committing (315e31f 10:59 scooped my four half-done lamp.rs edits into an unrelated laser commit). Root cause: no tree-liveness/provenance check (git status + git log -- path, KIT-T079) before editing a file in a sibling repo that can host its own session. Need a pre-edit guard for out-of-project edits: warn when the target repo has commits newer than N minutes or a dirty tree not attributable to this session.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] A PreToolUse(Write|Edit) hook fires only when the target file's repo is NOT the session's repo
- [x] It WARNS (exit 0, stderr) on evidence of another live session: HEAD newer than N minutes (default 30, configurable) or dirty paths absent from the turn-writes ledger
- [x] The message names the repo, the evidence, and "coordinate or use a worktree"
- [x] Escape token `[allow-live-tree: <reason>]` (prompt) + env, standard exclusion footer
- [x] Fails open on any git error; wired into hooks/hooks.json and documented in hooks/README.md
- [x] Automated test covering warn / no-warn / escape / dedupe / fail-open, wired into `npm test`

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. New hook `hooks/tree-liveness.mjs` + shared detector `hooks/live-sessions.mjs` (lib.mjs is at its hard length limit).
2. Wire PreToolUse(Write|Edit), document in hooks/README.md, test in hooks/tree-liveness.test.mjs.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
- Detection lives in `hooks/live-sessions.mjs` (recentCommits / foreignDirty / liveness) so orient
  (KIT-T225) and the pre-edit guard share one definition of "another session is live here".
- Repo identity compares `--git-common-dir`, so an edit between two worktrees of the SAME repo is
  not treated as a foreign-repo edit.
- Warns once per foreign repo per turn (turn state slot `tree-liveness`) — a multi-file edit run
  must not spam.
- Evidence: `node hooks/tree-liveness.test.mjs` — 12 passed; `node hooks/live-sessions.test.mjs` — 9 passed.

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
- [2026-08-16 00:39] (status) todo → doing
- [2026-08-16 00:40] (status) doing → review
- [2026-08-16 00:40] (comment) tree-liveness pre-edit guard: new hooks/tree-liveness.mjs + hooks/live-sessions.mjs, wired PreToolUse(Write|Edit); tests hooks/tree-liveness.test.mjs 12 passed
