---
id: KIT-D092
title: Sessions run the kit from the tested, published runtime copy, not the live checkout
summary: bootstrap, dev-link and the composed CLAUDE.md point the plugin install, the statusline and every <kit> path at ~/.claude/claude-kit-runtime/current; only npm run publish:runtime (green suite first) moves current.
date: 2026-10-13
source: Chris 2026-10-13, choice "Run from tested copy"; KIT-T450 (npm run publish:runtime); KIT-T460 (the wiring)
---

**Decision:**
- Every session runs the kit from `~/.claude/claude-kit-runtime/current/`, the committed tree exported by `npm run publish:runtime`. The working checkout is the writer's workspace and is never what a session loads.
- `current` moves only through `npm run publish:runtime`: the full suite runs first, and `scripts/runtime-publish.mjs` refuses to run outside that npm script.
- The wiring lives in the sources bootstrap composes from: `bootstrap.mjs` (plugin install link, statusline, tooling links, the `<kit>` placeholder in the composed `~/.claude/CLAUDE.md`) and `scripts/dev-link.mjs` (default target is the runtime; `--live` is the writer's loop). The composed files under `~/.claude` are never hand-edited.

**Why:** Chris 2026-10-13, asked how sessions should load the kit: "Run from tested copy". A half-edited script in the checkout broke every other live session at once (KIT-T450). Rejected: sessions loading the live checkout and relying on writers to keep it parseable.

**Correction 2026-10-13 (verified facts, KIT-T460):**
- Sessions here are launched by the PowerShell profile wrapper (`claude --plugin-dir D:\dev\claude-kit`). Measured inside a running hook: `CLAUDE_PLUGIN_ROOT=D:/dev/claude-kit`, hooks fire once per event and the harness labels the plugin `claude-kit@inline`, so `--plugin-dir` wins over the installed `claude-kit@claude-kit`. The plugin install link that bootstrap sets does not move these sessions.
- The wiring that makes hooks sealed does not depend on the plugin root: `hooks/compat-run.mjs` (the command in every hooks.json entry) is a tiny launcher that loads `compat-core.mjs` and the hook scripts from `~/.claude/claude-kit-runtime/current/hooks`. `--live` or `CLAUDE_KIT_LIVE=1` select the working tree.
- Hook code changes reach every running session at its next event, no restart. A NEW hooks.json entry needs a plugin reload or restart: registrations are read at session start (this session still lacks the hooks added to hooks.json since it started).
- The CLI scripts (`q`, `t`, `cap`) are sealed through the composed `~/.claude/CLAUDE.md` `<kit>` paths, which bootstrap rewrites to `current`. Editing profile.ps1 is optional: it additionally seals commands, agents, skills and hooks.json.
