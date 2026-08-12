# Installed marketplace agent copies go stale — model pin silently lost

2026-08-12, marblequest. Two `claude-kit:researcher` dispatches from a fable
main thread inherited fable silently: the kit SOURCE
(`claude-kit/agents/researcher.md`) pins `model: claude-opus-5` + `effort: low`
per KIT-T151, but the INSTALLED copy
(`~/.claude/plugins/marketplaces/claude-kit/agents/researcher.md`) predates the
pin and has no model/effort frontmatter at all. The dispatch-ladder hook did
not fire — it presumably trusts kit agent types as pinned, so a stale pinless
copy is invisible to it. One researcher burned ~93k tokens on fable for a
read-only sweep.

Root cause: no sync/verify step between claude-kit source agents and the
installed plugin marketplace copy. Fixes: (a) bootstrap/SessionStart check that
installed kit agent frontmatter matches source (or auto-resync); (b)
dispatch-ladder hook should verify the RESOLVED frontmatter has a model pin,
not trust the agent type's provenance; (c) convention: dispatch receipts state
model+effort explicitly so a silent inherit is visible in the transcript.
