---
id: KIT-T1609
title: process failure: a rapid-game push brief told a subagent to run 'git config core.hooksPath .githooks' in the shared checkout; source-shell-g
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T17:18:09Z
updated: 2026-11-27T17:18:09Z
---

## Description
process failure: a rapid-game push brief told a subagent to run 'git config core.hooksPath .githooks' in the shared checkout; source-shell-gate refuses any git config write by an agent while another writer is live, so the wiring step could not run. Root cause: the push brief template does not know the gate reserves shared git config to the main thread. Prevention: the coordinator wires core.hooksPath itself (once, quiet tree) before dispatching a push agent, or the brief check refuses a git config write in a subagent brief. Same agent also read the key with the bare form 'git config core.hooksPath', which the gate refuses; the read form is 'git config --get <key>'.

kit-bug-shape: cap:bug:process-failure-a-rapid-game-push-brief-told-a-s:3fd58ace
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the refusal of a git config write beside a live writer is judged intended and recorded on the ticket
- [x] the block names the read form and the route for the write: the coordinator runs it once no other writer is live; asserted in source-shell-gate-discard-live.test.mjs

## Plan
1.

## Notes
Judged: not a bug. The refusal is intended (KIT-T1266): git configuration is shared by every writer of the checkout, so a config write is a sweep, refused only while another writer is live (git-discards.mjs configOf, always false; delete-judge.mjs). The bare read git config core.hooksPath is refused by design too; the allowlisted read is git config --get <key>. The block already named the read form; its last sentence now also names the route for the write: raise it to the coordinator, who runs the same call once no other writer is live (a pre-push wiring such as core.hooksPath at a quiet moment, before a push agent is dispatched). Message-only change in hooks/lib/delete-guidance.mjs; three checks added to hooks/source-shell-gate-discard-live.test.mjs (75 passed) and hooks/git-integration-guard.test.mjs still passes (18 ok). Not changed, out of scope: the upstream-gate pre-push wiring block (lib/push-hooks.mjs wireCommand) prints the same config core.hooksPath command to whoever pushes, so a subagent push beside a live writer is told to run a call the shell gate refuses; the push brief template is the other half of the prevention named in the description.

## History
- [2026-11-27 17:18] (created) bug — process failure: a rapid-game push brief told a subagent to run 'git config core.hooksPath .githooks' in the shared checkout; source-shell-g
- [2026-11-27 19:03] (comment) criterion added: the refusal of a git config write beside a live writer is judged intended and recorded on the ticket
- [2026-11-27 19:03] (comment) criterion added: the block names the read form and the route for the write: the coordinator runs it once no other writer is live; asserted in source-shell-gate-discard-live.test.mjs
- [2026-11-27 19:04] (comment) ticked: the refusal of a git config write beside a live writer is judged intended and recorded on the ticket
- [2026-11-27 19:04] (comment) ticked: the block names the read form and the route for the write: the coordinator runs it once no other writer is live; asserted in source-shell-gate-discard-live.test.mjs
