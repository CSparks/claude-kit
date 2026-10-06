---
id: KIT-T337
title: Agent labels inconsistently carry the model name (Chris 2026-10-05: 'there's no consistent enforcement of putting the model name in the agen
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T01:44:10Z
updated: 2026-10-06T02:07:34Z
---

## Description
Agent labels inconsistently carry the model name (Chris 2026-10-05: 'there's no consistent enforcement of putting the model name in the agent description. Sometimes it does it. Sometimes it doesn't.'). KIT-T179 (review, 2edfe7a) built hooks/activity-tag.mjs + model-tag.mjs to auto-prefix tool_input.description with [<model>] via updatedInput, yet unprefixed dispatches still reach the activity line. Suspects: no-op outside an adopted repo/unbounded sessions; display map is a dated lineup (claude-opus-5-5 / sonnet-5-5 may map wrong or pass through); idempotency check vs hand-written '[claude-opus-5-5]' prefixes; updatedInput not honoured on some dispatch paths (background, resumed SendMessage, Workflow agents). Wanted: ONE enforced form on every dispatch, a test per path. Regression of KIT-T179.

kit-bug-shape: cap:bug:agent-labels-inconsistently-carry-the-model-name
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the hook applies ONE label form `[Family N.M] description` to every dispatch, with or without a caller-written prefix
- [x] the display name derives from the model id; the only map is the kit config's dispatch.aliases
- [x] a test per dispatch path (explicit alias/id, kit and project agent pin, inherit, Task/Agent, background, unadopted, no repo, hand-written prefixes, compat-run launcher)
- [x] root causes recorded

## Plan
1.

## History
- [2026-10-06 01:44] (created) bug — Agent labels inconsistently carry the model name (Chris 2026-10-05: 'there's no consistent enforcement of putting the model name in the agen
- [2026-10-06 02:07] (comment) ticked: the hook applies ONE label form `[Family N.M] description` to every dispatch, with or without a caller-written prefix
- [2026-10-06 02:07] (comment) ticked: the display name derives from the model id; the only map is the kit config's dispatch.aliases
- [2026-10-06 02:07] (comment) ticked: a test per dispatch path (explicit alias/id, kit and project agent pin, inherit, Task/Agent, background, unadopted, no repo, hand-written prefixes, compat-run launcher)
- [2026-10-06 02:07] (comment) ticked: root causes recorded
- [2026-10-06 02:07] (comment) @sonnet55: Landed ca308c0. Root causes found (each reproduced against the live hook, then fixed): (1) the dated LINEUP table matche (full comment #1 in ## Notes)
### comment #1 [2026-10-06 02:07] @sonnet55
Landed ca308c0. Root causes found (each reproduced against the live hook, then fixed): (1) the dated LINEUP table matched claude-opus-5\b, which also matches claude-opus-5-5, so opus 5.5 read 'Opus 5' and sonnet 5.5 read 'Sonnet 5'; opus-4-8 passed through as a raw id. Now derived from the id (Family major.minor) with aliases only in kit config dispatch.aliases. (2) Idempotency treated ANY recognised leading tag as done, so a hand-written [opus] / [claude-opus-5-5] / stale [Fable 5] stayed in its own form, possibly naming the wrong model, while [sonnet55] stacked a second tag. Now every leading model tag is replaced by the resolved model's tag. (3) activity-tag no-op'd on unadopted repos and with no repo (gitRoot empty); gate removed, tag is cosmetic and global. (4) model: inherit in a definition returned 'inherit' and labelled lines [inherit]; now resolves to the session model. (5) a <synthetic> latest assistant turn was read as the session model; skipped. Ruled out: matcher (Task|Agent in hooks.json and settings.recommended), updatedInput shape, installed copy (cache 0.1.18 current; this session loads hooks from the claude-kit@inline source). Not hookable: SendMessage resumes and Workflow agent() calls fire no Agent PreToolUse. Sessions loaded before this commit keep the old hook until restart. Tests: hooks/activity-tag.test.mjs 26 passed (new, one per path incl. compat-run launcher and hooks.json matcher), model-tag 66, plugin-compat 114, full npm test chain 1493 passed (server tests excluded, express missing, KIT-T290); mutations: adopted gate restored fails 1, tag-replacement removed fails 4. Same staleness explains KIT-T326 step 4: patch-worker is registered; only sessions started earlier lack it.
- [2026-10-06 02:07] (status) todo → review
