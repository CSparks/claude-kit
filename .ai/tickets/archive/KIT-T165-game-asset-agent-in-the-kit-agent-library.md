---
id: KIT-T165
title: Game-asset agent in the kit agent library
type: feature
status: done
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-03T00:01:12Z
updated: 2026-08-03T00:07:13Z
---

## Description
Chris (2026-08-02): "Create a fable agent at the claude-kit level as a game asset
creation expert."

Game asset authoring keeps recurring across game projects and is the one role where the
agent's defining constraint is the standing global rule that **visual output is not
evidence** — the agent has no eyes, so it must translate a visual ask into measurable
structure and verify with numeric dumps. That constraint plus the modularity contract
(atomic factory files in a by-concern tree, composed via a registry) is generic and
non-proprietary, so it belongs in the kit library rather than any one project.

`model: fable` is an explicit maintainer override of the kit's usual `model: opus` pin
(the ladder reserves fable for the hardest reasoning) — asset authoring is
spatial-reasoning-heavy and blind, which is the case the override is for.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] `agents/game-asset-artist.md` exists with kit-standard frontmatter (name,
      description, tools, model) and pins `model: fable`
- [x] Body carries the lean Operating-context digest, not a copy of the full contract
- [x] The no-visual-evidence rule is the agent's leading, non-negotiable section
- [x] Tool grant is least-privilege (no WebSearch/WebFetch; matches refactorer/test-author)
- [x] Registered in `.claude-plugin/plugin.json` `agents[]` so the plugin ships it
- [x] Listed in the `agents/README.md` index table with its tools
- [x] Kit suite still green

## Plan
1. Read the existing kit agents for the house shape (done — researcher/refactorer/
   test-author share frontmatter + Operating-context digest + Verify + What-you-return).
2. Author `agents/game-asset-artist.md`.
3. Register in plugin.json + README index.
4. Run the kit suite.

## Notes
Verification: `npm test` (kit root) run green end to end — the chain is `&&`-joined, so
the final suite reaching `pass 29 / fail 0` means every prior gate suite passed too.
No new test was added: the deliverable is a prompt definition, and the kit has no
agent-manifest parity test to extend. [no-test: agent definition is prose, not code —
the only mechanical surface is the plugin.json registration, covered by the suite run]

Design calls made without asking:
- Name `game-asset-artist` (generic role, non-proprietary — kit rule).
- Tools kept to the refactorer/test-author set; no WebSearch/WebFetch. The researcher
  already owns external lookup, and a tight `tools:` list is a token lever (KIT-T030).
- Scope covers geometry + materials + textures + the factory/registry structure, and
  explicitly excludes render-pipeline/lighting-rig work and aesthetic sign-off — those
  are the two places a blind asset agent would otherwise overreach.

## History
- [2026-08-03 00:01] (created) feature — Game-asset agent in the kit agent library
- [2026-08-03 00:07] (status) todo → done
