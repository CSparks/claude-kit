---
id: KIT-T295
title: dispatch-guard broker-owned-tree block tells you to dispatch the 'claude-kit:patch-worker' agent, but no such agent type is installed (patch
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T19:41:57Z
updated: 2026-10-04T17:48:32Z
---

## Description
dispatch-guard broker-owned-tree block tells you to dispatch the 'claude-kit:patch-worker' agent, but no such agent type is installed (patch-worker exists only as a skill), so a broker-owned tree leaves no legal way to delegate a build. Ship agents/patch-worker.md (model pinned, no Edit/Write) or ch

kit-bug-shape: cap:bug:dispatch-guard-broker-owned-tree-block-tells-you
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] patch-worker agent is registered and installable; may write envelope files to scratchpad/temp only; plugin version bumped so installed copies refresh

## Plan
1.

## History
- [2026-10-02 19:41] (created) bug — dispatch-guard broker-owned-tree block tells you to dispatch the 'claude-kit:patch-worker' agent, but no such agent type is installed (patch
- [2026-10-04 17:48] (comment) criterion added: patch-worker agent is registered and installable; may write envelope files to scratchpad/temp only; plugin version bumped so installed copies refresh
- [2026-10-04 17:48] (comment) ticked: patch-worker agent is registered and installable; may write envelope files to scratchpad/temp only; plugin version bumped so installed copies refresh
- [2026-10-04 17:48] (comment) @sonnet55: Root cause: the manifest and frontmatter were correct (claude plugin validate accepts agents/patch-worker.md); sessions  (full comment #1 in ## Notes)
### comment #1 [2026-10-04 17:48] @sonnet55
Root cause: the manifest and frontmatter were correct (claude plugin validate accepts agents/patch-worker.md); sessions started before c252b14 (2026-10-02 13:14) never saw it, and the INSTALLED claude-kit@claude-kit copy (cache 0.1.17, commit ed090ce, 2026-08-21) predates analyst and patch-worker while the version string never changed, so autoUpdate never refreshed it. Fix: version 0.1.18 in both manifests (also repairs the failing Claude/Codex same-version test); agent text and skill allow envelope files under the session scratchpad or system temp, never in a broker-owned tree; guard message says so; dispatcher may pass model opus. Tests: scripts/plugin-compat.test.mjs 105 passed (new: every tracked agents/*.md registered, frontmatter valid, no duplicates, registered paths exist), hooks/dispatch-broker.test.mjs all PASS incl. opus55 writer still blocked. Mutation (drop patch-worker from the manifest) fails the registration test. A running session needs a plugin reload or restart: its agent list is built at start.
- [2026-10-04 17:48] (status) todo → review
