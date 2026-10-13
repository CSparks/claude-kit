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
