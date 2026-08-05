---
id: KIT-T179
title: Every delegated subagent's activity line and roster entry carries its model tag
type: feature
status: doing
priority: medium
milestone:
labels: [models, dispatch, hooks, visibility]
links: [KIT-T034, KIT-T177, KIT-T178, KIT-D035, KIT-D042, KIT-D043]
files:
  - hooks/model-tag.mjs
  - hooks/activity-tag.mjs
  - hooks/agent-roster.mjs
  - hooks/dispatch-guard.mjs
  - hooks/orient.mjs
  - hooks/model-tag.test.mjs
  - hooks/hooks.json
  - hooks/README.md
  - user-config/settings.recommended.json
supersedes:
superseded_by:
created: 2026-08-05T16:07:49Z
updated: 2026-08-05T16:07:49Z
---

## Description
A delegation's MODEL is the one fact that decides what it costs, and it is invisible at every
place the delegation is watched. Claude Code's native activity line reads
`general-purpose  Build CRX-T024 admin foundation` — the tier is nowhere in it, so a silent
fable inherit or a mis-tiered dispatch reads exactly like a correct one until the bill lands.
The kit's own surfaces have the same hole: `.ai/agents.jsonl` records scope/background/
isolation/targetRoot but not model, so orient's in-flight replay cannot show it either.

Make the model visible where the work is watched: `general-purpose [Opus 5] Build CRX-T024 …`
on the native line, and the same bracket tag on the kit's roster-backed renders. Complements
KIT-T151's dispatch-ladder gate — that one BLOCKS the silent fable inherit, this one makes
every dispatch's tier legible whether or not a gate fired.

## Acceptance Criteria
- [x] One shared model resolver (`hooks/model-tag.mjs`): explicit `tool_input.model` →
      agent-definition `model:` frontmatter pin → session model from the transcript. The pin +
      transcript resolvers live there ONCE and dispatch-guard imports them (no second copy).
- [x] A display map in ONE place: opus/`claude-opus-5*` → `Opus 5`, fable → `Fable 5`,
      sonnet → `Sonnet 5`, haiku/`claude-haiku-4-5*` → `Haiku 4.5`; unknown passes through
      verbatim. Commented as a DATED lineup fact (KIT-D035/D042/D043 territory).
- [x] `PreToolUse(Task|Agent)` hook rewrites the activity line: `tool_input.description`
      gains a `[<Display>] ` prefix via `hookSpecificOutput.updatedInput` — VERIFIED against
      the current hooks contract before building, not assumed (the KIT-T177/T178 lesson).
- [x] Idempotent (never double-prepends), fail-open on any parse error, no-op outside an
      adopted repo, and it never weakens dispatch-guard — it emits NO `permissionDecision`,
      so a deny/ask from the gate on the same event still stands.
- [x] The roster row carries the resolved model; orient renders `(scope [Opus 5])` on
      in-flight and finished lines, and a row without a model renders exactly as before.
- [x] dispatch-guard's shared-tree block message shows the same tag on each live agent.
- [x] Tests in the kit's hook-test shape covering resolution precedence, display mapping,
      idempotence, fail-open, unadopted no-op, roster row shape, and the orient render with
      and without a model. Full `npm test` green.

## Plan
1. Extract `pinnedModel` + `latestAssistantModel` out of dispatch-guard into `model-tag.mjs`,
   add `resolveDispatchModel` + `modelDisplay` + `tagDescription` there.
2. New `activity-tag.mjs` PreToolUse hook emitting `updatedInput`.
3. `agent-roster.mjs` records the resolved model; orient + dispatch-guard render it.
4. `model-tag.test.mjs`; wire the hook in `hooks.json` + `settings.recommended.json`; README.

## Notes
- 2026-08-05: Contract VERIFIED against https://code.claude.com/docs/en/hooks §"PreToolUse
  decision control" before building. Documented verbatim: "`PreToolUse` hooks can allow, deny,
  or ask the user before a tool call runs. They can also rewrite the tool's input arguments."
  and the field table's `updatedInput` — "Object with the same shape as `tool_input`, replacing
  the tool's arguments before it runs." `permissionDecision` is optional; "Omitting the field is
  equivalent to `"defer"`", which is exactly why this hook omits it — a rewrite must never
  upgrade a dispatch-guard `deny` into an `allow` on the same event.
- The docs do NOT define what happens when two hooks on one event both return `updatedInput`.
  Only this hook returns one, so the ambiguity is not load-bearing here; if a second rewriter is
  ever added, that ordering must be settled first.
- The KIT UI has NO delegated-agent surface to tag: `server/services/*` + `ui/src/*` use "agent"
  for the VIEWER IDENTITY (comment author / mention target, `resolveAgent()`), and nothing reads
  `.ai/agents.jsonl`. Verified via code-graph (`readAgents` importers = orient, flush,
  dispatch-guard, agent-roster only) and by listing every route/service/page. The UI's roster
  view is KIT-T133 (headless dispatch, still `todo`) — the model tag belongs in that ticket's
  render when it lands, not invented ahead of it.

## History
- [2026-08-05 16:07] (created) feature — Every delegated subagent's activity line and roster entry carries its model tag
- [2026-08-05 16:12] (status) todo → doing
- [2026-08-05 16:12] (decision) hooks contract verified against code.claude.com/docs/en/hooks: `updatedInput` under `hookSpecificOutput` IS supported for PreToolUse; hook omits `permissionDecision` so it cannot weaken dispatch-guard.
