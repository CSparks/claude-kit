# SESSION

## Current state (2026-08-25)
KIT-T189 is in `review`: the UNBOUNDED catch-all store shipped (decision KIT-D068).

A session with no `.ai/` above its cwd now resolves to one configured catch-all store instead
of no-op'ing. Store: `D:\dev\claude-kit-data\unbounded\.ai` (pinned in
`~/.claude/claude-kit-projects.json` -> `unbounded`; env override `CLAUDE_KIT_UNBOUNDED_AI`).

- resolution: `hooks/lib/unbounded.mjs` -> `resolveStoreRoot()`, used by cap / t / q /
  orient / flush. commit-gate stays repo-scoped (asserted).
- identity per ITEM: `hooks/lib/session-identity.mjs`, `<store>/.ai/.session` (gitignored),
  `cap topic <slug>`; captures carry trailing `topic:` / `session:` lines.
- retrieval: `q topics`, `q --topic <slug>` (`scripts/q-topics.mjs`, scan-only verbs).
- promotion: `t move <id> <repo-path>` (`scripts/t-move.mjs`).
- scaffold: `node scripts/init-unbounded.mjs`.

Seeded from the real `~` session `8df0fda7-13d9-4477-a0b2-035005e8bb80`: 5 items under
topics `llm-rig` (3) and `comfy-volta` (2).

Tests: `scripts/unbounded.test.mjs` 31/31; `hooks/flush.test.mjs` 14/14;
`scripts/cap.test.mjs` 35/35. Full suite 62/63 suites, 1176 assertions.

## Next 3 steps
1. UAT: start a real session in `~`, confirm the orientation block and `cap topic` / `cap`.
2. Pre-existing reds to clear (NOT this ticket): `agents/rg-ui-engineer.md` has no `effort:`
   pin (agent-pins.test.mjs); `server/server.test.mjs` needs `express`, which is not a
   declared dependency.
3. Pre-existing debt: `scripts/t.mjs` is 624 lines, past the 600-line hard gate (was 609
   before this change) — needs a by-concern split before it can be Edit'd again.
