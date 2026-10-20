---
id: KIT-T298
title: Other agents (GPT Sol) edit Rust directly in the shared stiletto/rapid-game checkout outside the broker; every save pauses the broker queue
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T03:02:35Z
updated: 2026-10-20T00:53:30Z
fixed_commit: b6dd07f
---

## Description
Other agents (GPT Sol) edit Rust directly in the shared stiletto/rapid-game checkout outside the broker; every save pauses the broker queue (dirty_blocks), so landings stall until someone commits for them. Give non-Claude agents a broker submit path (patch-worker flow for Codex/GPT) or a documented 

kit-bug-shape: cap:feature:other-agents-gpt-sol-edit-rust-directly-in-the-s
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-03 03:02] (created) feature — Other agents (GPT Sol) edit Rust directly in the shared stiletto/rapid-game checkout outside the broker; every save pauses the broker queue
- [2026-10-13 19:49] (comment) @sonnet55: Proposed fix (not built; cross-agent policy, needs the maintainer): two parts. (A) Give non-Claude agents a documented b (full comment #1 in ## Notes)
### comment #1 [2026-10-13 19:49] @sonnet55
Proposed fix (not built; cross-agent policy, needs the maintainer): two parts. (A) Give non-Claude agents a documented broker path: scripts/broker/submit.mjs already takes a stdin envelope and --no-patch (KIT-T317), so it is agent-neutral; add a short AGENTS.md section for Codex/GPT with the submit/wait/land commands and the rule 'never edit .rs/Cargo.toml in the live tree'. The maintainer controls those agents' instructions, so this is the only lever that stops the writes. (B) Soften the symptom: dirty_blocks pauses on any modified *.rs, but only paths a queued job touches can actually collide; a mode 'dirty_blocks: touched-only' (pause only when a dirty path is in the job's patch) would stop saves from stalling unrelated landings, at the cost of letting a job build over someone's half-edited file. Recommend A, with B off by default. Decision needed: A only, or A+B.
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) [no-test: documentation] docs/BROKER.md says any agent (Claude or not) uses submit.mjs and wait.mjs, and what a hand edit costs
