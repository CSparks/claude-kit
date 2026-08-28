(bug) Lost a durable fact across sessions: the MiniMax H3 Volta fp16 workaround (Amduraznak/minimax-h3-fp16-fix + --fp16-unet) was found and endorsed 2026-08-22 but never persisted to memory or a plan-of-record; the 2026-08-24 session re-derived H3 (bf16 emulation, 3x slower) until the maintainer recalled it. Root cause: no capture step for 'recipe found, not yet applied' facts in non-.ai sessions (home dir); memory writes only happen on completion. Fix: PreCompact/Stop flush prompts to persist endorsed-but-unapplied recipes/URLs to memory.

**Correction (Chris, 2026-08-25):** both the original discussion (2026-08-22) and the
re-derivation (2026-08-24) happened in `~` — NOT a kit-initiated repo. The kit's PreCompact/
Stop flush no-ops without `.ai/`, so a flush-side fix would never fire here. Real gap:
non-`.ai/` sessions have auto-memory as their only durable record, and nothing prompts a
memory write for "found/endorsed, not yet applied" facts (recipes, URLs, decisions) — only
completed work gets remembered. Fix must live in the memory discipline that runs everywhere
(CLAUDE.md rule + a hook that is NOT gated on `.ai/`), not in the `.ai/` flush.
