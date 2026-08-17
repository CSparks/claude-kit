---
id: KIT-T240
type: feature
status: review
priority: high
scope: KIT
fixed_commit: e11a54c
---

# Framework-scoped context: rules bind a framework's consumers, and surface only there

**Chris, 2026-08-17:** "There needs to be a more modular way to have it surface than the
fucking global file. If I'm editing a fucking web project, I've got shit like that
accumulating and filling context." And earlier, on why a decision file was the wrong
home: "ANY FUCKING GAME THAT USES RAPID GAME NEEDS TO FOLLOW THIS FUCKING RULE."

## The gap

A rule binding every consumer of a framework had no home. Three candidates, all wrong:

- **`.ai/decisions/`** — passive. Nothing queries it before work starts, so it never
  fires. (This is where I filed it first; that was the error that started this.)
- **Project CLAUDE.md** — needs hand-copying into every consuming game. That is the same
  drift the rules themselves forbid, and it goes stale per game.
- **Global CLAUDE.md** — loads in EVERY repo, so a game-asset contract burns context in a
  web project, and the cost compounds with each framework added.

Only two homes load automatically: the global contract and the hooks. Neither was
framework-scoped.

## Acceptance criteria

- [x] One file per framework, `frameworks/<name>.md`, holding the contract text ONCE.
- [x] A `detect:` block matched against the repo — submodule name, vendored path, or
      manifest dependency. Any one signal is sufficient.
- [x] SessionStart orientation emits the contracts that bind, and NOTHING when none do.
- [x] A repo using no known framework pays zero context.
- [x] Fail-open: a malformed doc costs only itself; a missing `frameworks/` tree costs
      the section, never the session.
- [x] Adding a framework is dropping one file — no hook edit, no global change.
- [x] The rapid-game asset contract moved out of the global base into
      `frameworks/rapid-game.md`.

## Notes

- Landed `e11a54c`. `hooks/lib/frameworks.mjs` + `frameworks/rapid-game.md`, wired into
  `hooks/orient.mjs` ahead of the commit list.
- Tests: `hooks/lib/frameworks.test.mjs`, **12 passed**; `hooks/orient.test.mjs` still
  green. Asserted in both directions — a repo with the rapid-game submodule gets the
  section, a plain web repo with `react` in `package.json` gets `''`.
- Bug caught in end-to-end verification, now regression-tested: the kit-root path was one
  level short, so `frameworks/` resolved under `hooks/` and the section silently rendered
  nothing. The unit tests had passed because they were passing the directory explicitly —
  the added test exercises the default path orientation actually takes. **Lesson: a test
  that injects the path does not cover the caller that does not.**

## Follow-up

- Detection is orientation-time only. A gate that fires before ASSET WORK specifically
  (the pre-write path) would enforce rather than inform — the contract currently relies
  on me having read the section.
- `research/` KB docs and kit agents could be framework-scoped by the same mechanism.

## History

- [2026-08-17 02:00] (status) todo -> doing
- [2026-08-17 02:00] (comment) captured as inbox 2026-08-17-0159 after ST-D042 was filed in the wrong (project, passive) home
- [2026-08-17 02:00] (fixed) e11a54c
- [2026-08-17 02:00] (status) doing -> review
