# Local Qwen lane

Dispatch lane for targeted changes on the local Qwen 3.8 27B (KIT-D080). The orchestrator routes
to it from the capability table (`.ai/config.yml` `dispatch.jobs`, row `targeted-change`, family
`local-qwen`).

## When to use it

Chris, 2026-10-05: "Qwen is a decent coder if the change is straight forward and it's not having to
be too creative or consider a large breadth of code. It's probably fine at making most targeted
changes, given enough context."

- Use it for a straightforward change in named files where the brief supplies the context.
- Default for a targeted change both Qwen and Sonnet could do: Qwen first.
- Do not use it for design, wide-breadth exploration, or anything creative. Those go to the
  `design`, `build`, `asset` and `research` rows.

## Escalation

After 2 failures on the same ticket (a failed attempt = the report says `status: error`, the
acceptance check failed, or the broker verdict was not green after the wrapper's own revisions),
the orchestrator re-dispatches the ticket to the row's `fallback:` family (sonnet). It does not
retry Qwen a third time and does not rewrite the brief to be vaguer.

## Brief template

The brief is a file; the agent sees nothing else. Name everything.

```
Ticket: <ID>
Change: <one or two sentences, imperative>
Files and ranges:
  - <path>:<first line>-<last line>   <what is there / what to do to it>
  - <path>:<first line>-<last line>
Context the agent cannot guess: <types, call sites, naming rule, why>
Acceptance:
  - <observable check, ideally a command and its expected result>
Out of scope: <files and behavior not to touch>
```

## Running one

```
node <kit>/scripts/local-agent.mjs --brief <brief.md> --repo <dir> --report <report.md> \
  --ticket <ID> --title "<commit-style title>" [--test "cargo t -p x"] [--job targeted-change]
```

- Launches `codex exec` through `D:\llm\codex-local.cmd` (profile `local`), model `qwen3.8-27b-3x`.
  The launcher starts the router if it is down. Override the rig dir with `--rig` or `LLM_RIG_DIR`.
- Up to 3 run at once (`--slots`). A fourth exits 75. Slot files live in `%TEMP%\kit-local-agent`.
- `--dry-run` prints the launcher command, arguments and prompt without spawning.
- The report file carries `mode`, `model`, `job`, `status`, seconds, and every attempt's reply.
- Each run appends a roster row (`model: local-qwen`, `job`, `durationMs`) to the repo's
  `.ai/agents.jsonl`, so `node <kit>/scripts/dispatch-outcomes.mjs` counts it.

### Direct tree

The agent edits files in `--repo` (sandbox `workspace-write`). That makes it a writer: the one
read/write agent per checkout rule applies (KIT-D077), and the wrapper refuses a second direct-mode
agent in the same repo. Run three in parallel only in three different checkouts, or in a broker tree.

### Broker-owned tree

When `target/broker/broker.lock` is live the agent gets a read-only view and returns a patch
envelope between `=== PATCH BEGIN ===` and `=== PATCH END ===`. The wrapper submits it
(`scripts/broker/submit.mjs`), waits (`wait.mjs`), and on `stale`, `gate` or `failed` feeds the
verdict back for up to `--max-revisions` (default 2) revisions, per `skills/patch-worker`. The
local agent never writes the tree. `--land` resubmits a green patch with `--land` (needs
`--ticket`). Any number of broker-mode agents share a tree, three at a time through the lane.

## The rig side

`D:\llm\run.ps1` writes the 3-slot preset `qwen3.8-27b-3x` into `models.ini` (never hand-edit it):
`parallel = 3` with `ctx-size = 3 x 65536`. Context is split evenly across the slots, so each agent
has 64K; the codex/opencode system prompt and tool schemas take about 12K of that, which is why the
brief must be tight. See `D:\llm\README.md` for the VRAM figure and the apply command.
