---
id: KIT-T1360
title: implementation agent (road-generator mountain job, 2026-11-18) hit three source-shell-write blocks, all process failures of the agent: (1) r
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T00:36:24Z
updated: 2026-11-18T02:56:40Z
fixed_commit: 7d036958
---

## Description
implementation agent (road-generator mountain job, 2026-11-18) hit three source-shell-write blocks, all process failures of the agent: (1) ran bare 'builds --run' to read its usage instead of the brief's stated form; (2) tried to A/B a shipped data file (world.ron) by sed/cp from the shell; (3) tried rm -rf on a scratch folder under target/. Root cause: the agent definition names Edit/Write for source but gives no sanctioned recipe for a parameter sweep over a data file. Prevention: add to the implementation agent definition: 'a sweep over a data file runs on a scratch asset root under target/ (copy the assets there, point the program at it by its asset-root env), edits of the copy by Write; never rewrite the shipped file from the shell, never rm -r a scratch folder (leave it or overwrite files), and the builds --run form is: builds --run "<cmd>" --out target/<file> --timeout N --tool-timeout N'.

kit-bug-shape: cap:bug:implementation-agent-road-generator-mountain-job:cd2a7eb7
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the implementer definition and the source-shell gate's write advice carry the data-file sweep recipe: a scratch asset root under target/ (cp -r assets target/sweep-assets), BEVY_ASSET_ROOT or the program's own setting, Edit/Write on the copy, never sed/cp over the shipped file, never rm -r the scratch folder (hooks/agent-recipes.test.mjs)

## Plan
1.

## Notes
Recipe written into agents/implementer.md (Discipline) and hooks/lib/source-shell-advice.mjs WRITE_ADVICE (printed on every source-shell-write refusal). Delete route under target/: the shell-delete rule does not judge build output (hooks/lib/tree-delete.mjs BUILD_OUTPUT = target, node_modules, dist, build), but the recipe still says leave the scratch folder or overwrite its files, never rm -r, as the ticket asks; a probe of the gate in a plain repo passed cp into target/, sed on the copy and rm -rf target/sweep, so the agent's refusals came from that project's state, not checked further. Test: hooks/agent-recipes.test.mjs.

## History
- [2026-11-18 00:36] (created) bug — implementation agent (road-generator mountain job, 2026-11-18) hit three source-shell-write blocks, all process failures of the agent: (1) r
- [2026-11-18 02:54] (status) todo → doing
- [2026-11-18 02:54] (comment) criterion added: the implementer definition and the source-shell gate's write advice carry the data-file sweep recipe: a scratch asset root under target/ (cp -r assets target/sweep-assets), BEVY_ASSET_ROOT or the program's own setting, Edit/Write on the copy, never sed/cp over the shipped file, never rm -r the scratch folder (hooks/agent-recipes.test.mjs)
- [2026-11-18 02:54] (comment) ticked: the implementer definition and the source-shell gate's write advice carry the data-file sweep recipe: a scratch asset root under target/ (cp -r assets target/sweep-assets), BEVY_ASSET_ROOT or the program's own setting, Edit/Write on the copy, never sed/cp over the shipped file, never rm -r the scratch folder (hooks/agent-recipes.test.mjs)
- [2026-11-18 02:56] (landed) 7d036958 wait.mjs reads a builds --run id once instead of answering unknown job; the broker-wait block and the wait rule name ONE
- [2026-11-18 02:56] (status) doing → review
- [2026-11-18 02:56] (comment) runtime 7d036958 published, plugin 0.1.57
