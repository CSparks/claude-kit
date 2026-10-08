---
id: KIT-T395
title: Process failure: an outward-facing upstream contribution (bevyengine/bevy#26045, 2026-10-07) was drafted, committed with a Co-Authored-By Cl
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T396
superseded_by:
created: 2026-10-08T21:01:37Z
updated: 2026-10-08T21:12:36Z
---

## Description
Process failure: an outward-facing upstream contribution (bevyengine/bevy#26045, 2026-10-07) was drafted, committed with a Co-Authored-By Claude trailer and opened with AI-written PR prose without reading the target project's contribution / AI policy; Bevy bans AI-authored commits and AI prose (bevy.org/learn/contribute/policies/ai) and closed it. Root cause: no step or gate requires reading a foreign repo's CONTRIBUTING + AI policy before any upstream PR/issue, and the commit-attribution default (Claude trailer) is applied to foreign repos. Want: an upstream-contribution gate (gh pr create / gh issue create against a repo the kit does not own) that surfaces the target's AI policy and blocks AI trailers/prose where banned; a kit rule that upstream submissions are maintainer-authored when policy requires.

kit-bug-shape: cap:bug:process-failure-an-outward-facing-upstream-contr
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] upstream-gate hook blocks gh pr/issue create|comment and git push to non-CSparks repos without [upstream-policy-read: ...; ai-allowed: yes|no]
- [x] ai-allowed: no also blocks Claude trailers in pending commits; GIT WORKFLOW rule in user-config/CLAUDE.global.md

## Plan
1.

## History
- [2026-10-08 21:01] (created) bug — Process failure: an outward-facing upstream contribution (bevyengine/bevy#26045, 2026-10-07) was drafted, committed with a Co-Authored-By Cl
- [2026-10-08 21:12] (comment) criterion added: upstream-gate hook blocks gh pr/issue create|comment and git push to non-CSparks repos without [upstream-policy-read: ...; ai-allowed: yes|no]
- [2026-10-08 21:12] (comment) criterion added: ai-allowed: no also blocks Claude trailers in pending commits; GIT WORKFLOW rule in user-config/CLAUDE.global.md
- [2026-10-08 21:12] (comment) ticked: upstream-gate hook blocks gh pr/issue create|comment and git push to non-CSparks repos without [upstream-policy-read: ...; ai-allowed: yes|no]
- [2026-10-08 21:12] (comment) @claude: Landed 567dfa3: hooks/upstream-gate.mjs + hooks/lib/upstream-policy.mjs (check-id upstream-policy), wired in hooks.json  (full comment #1 in ## Notes)
### comment #1 [2026-10-08 21:12] @claude
Landed 567dfa3: hooks/upstream-gate.mjs + hooks/lib/upstream-policy.mjs (check-id upstream-policy), wired in hooks.json + settings.recommended.json, README rows, rule in CLAUDE.global.md GIT WORKFLOW. Test: hooks/upstream-gate.test.mjs 36 passed (bevy block without token, pass with ai-allowed: yes, block ai-allowed: no + Claude trailer in pending commits, CSparks negative controls, exclusions, fail-open); branch-guard 41 passed after moving toPath/cdTarget to lib/shell-segments.mjs; other hook suites pass. npm test stops at server/server.test.mjs: express not installed (env, unrelated). Design note: runs in unadopted repos too (a fork checkout is not adopted).
- [2026-10-08 21:12] (status) todo → review
- [2026-10-08 21:12] (comment) ticked: ai-allowed: no also blocks Claude trailers in pending commits; GIT WORKFLOW rule in user-config/CLAUDE.global.md
