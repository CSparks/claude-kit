## Workflow contract (.ai/)

The taxonomy, routing, priorities, statuses, and drain rules live in
`.ai/config.yml`. Read it at session start; it is the source of truth.

### Interjections default to capture

When the user interjects during active work, classify the input against
`.ai/config.yml`, route it to the configured store, emit a one-line receipt, and
continue. Stop only when the classification's blocking rule fires, the new input
changes active scope, it reports a regression caused by the current edit, or the
user explicitly says to stop. If the domain nouns do not fit this repository,
confirm the target project before routing.

Use `$cap` for explicit capture. Captured work is durable only after it reaches an
atomic file under `.ai/`; do not leave important work solely in chat or a plan.

### Work the durable queue

- `$triage` promotes `.ai/inbox/` captures into tickets, decisions, questions,
  or notes according to `.ai/config.yml`.
- `$work <id>` handles one named ticket. Read it, restate its acceptance criteria,
  and confirm scope before editing. Use the `t` CLI for structured status and
  criterion mutations rather than hand-editing frontmatter.
- `$drain` selects the next ready item from the configured queue.
- `$done <id>` is the human-acceptance path for a review-stage ticket. Never infer
  that acceptance.
- `$standup` is read-only. `$prime` reconstructs a resume briefing from disk.
- `$decide` batches unresolved human decisions.

For an active ticket, mirror the acceptance criteria in the Codex plan. The ticket
file remains authoritative; the plan is only a live projection. When a criterion
is satisfied, update the ticket and plan together. Before moving to `review`, cite
the test artifact in the ticket or record an explicit `[no-test: reason]`.

### Durable session state

`.ai/`, git, and the durable agent roster outrank chat summaries and memory.

- Keep `.ai/SESSION.md` current after meaningful steps: current state, exact
  commands/errors/paths/version pins, and the next three steps. Keep it to one
  screen and overwrite stale content.
- Append settled choices to the atomic decisions store and cite them instead of
  relitigating them.
- Use `$flush` before manual compaction, clearing, or a deliberate handoff.
- After compaction or resume, reconcile from `.ai/SESSION.md`, the active ticket,
  `.ai/agents.jsonl`, and git before continuing.

### Subagents and verification

Use Codex subagents only when the user asks for delegation or parallel agent work,
or when higher-priority instructions explicitly allow it. Give each subagent a
bounded task and return concise pointers, not file dumps. Plugin hooks maintain the
durable roster across `Agent` and `SubagentStop` events.

Run verification proportionate to the change. Report actual command results. Do
not claim a visual or audio result from inaccessible perception; use numeric probes
and leave aesthetic acceptance to the user.

### Generated and append-only files

- `tickets/INDEX.md`, `REGRESSIONS.md`, and generated `ROADMAP.md` are views; rebuild
  them with the kit scripts rather than editing them.
- Ticket `## History` is append-only structured output from the `t` CLI.
- Ticket `## Notes` is append-only narrative progress.
- Atomic stores use one file per item. Do not collapse them into monoliths.
