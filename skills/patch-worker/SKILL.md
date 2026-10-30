---
name: patch-worker
description: Work a ticket as a broker patch worker — read the tree, author the change as a search/replace patch, submit it to the shared broker daemon on stdin, wait for the result, revise on stale/gate/failed, then land through the broker. Use when a project's broker daemon owns the checkout (target/broker/broker.lock is live) and many agents queue patches instead of editing.
---

# patch-worker — queue patches, never write the tree

The broker daemon (`scripts/broker/broker.mjs`) is the ONLY writer in the checkout. It
applies your patch, runs the kit's pre-write gate on every file, builds and tests with the
one warm `CARGO_TARGET_DIR`, and with `--land` commits by explicit paths and pushes. Your
Write tool reaches only the system temp dir (envelopes, drafts); you never run cargo. Operator setup + schemas: `docs/BROKER.md`.

## The loop

1. **Read** the current files you will change. The tree moves between your submits; a
   patch is matched against `HEAD` at submit time and again at run time.

2. **Submit a check-only patch** (no `--land`). The envelope goes on stdin; nothing is
   written to the tree:
   ```
   id=$(node <kit>/scripts/broker/submit.mjs --root <tree> --ticket ST-T123 --title "…" \
     --test "cargo t -p rg-sim --lib relevance" <<'PATCH'
   *** edit crates/sim/src/relevance/step.rs
   <<<<<<< SEARCH
   exact old text, unique in the file
   =======
   new text
   >>>>>>> REPLACE
   *** write crates/sim/tests/x.rs
   full content of a NEW file
   *** delete path/y.rs
   *** write-binary assets/x.glb
   base64 lines of a binary file (or pass --binary assets/x.glb=<file> and no stdin); replaces the file whole
   PATCH
   )
   node <kit>/scripts/broker/wait.mjs $id --root <tree> --timeout 280
   ```
   - An `edit` block applies while its SEARCH text matches exactly once. Include enough
     context lines to be unique. One `*** edit` header may carry several blocks.
   - `write` creates a new file; it refuses a path that already exists.
   - `--test` is repeatable; omit it to run the project's `verify_default`. Use the
     project's cargo aliases (`cargo t`, `cargo b`); the broker adds `-j` and
     `--no-fail-fast`.
   - `--repo rapid-game` targets the submodule; paths are relative to it.

3. **Read the result.** `submit` answers in seconds when the patch fails the pre-write gate, does not apply
   (`stale`) or does not compile (`cargo check` in the broker's own precheck tree): the result prints as JSON, exit 1,
   and the job never takes a queue slot. Otherwise it prints the id and you wait AT MOST ONCE, in the foreground:
   `wait.mjs <id> --root <tree> --timeout 280` (the hook adds the timeout and a Bash timeout under 5 minutes).
   `wait` exits 0 for passed/landed, 1 otherwise, 2 when the wait ended with the job still queued or running.
   On exit 2, or when a second wait would follow, do not wait again: write the handoff and end (see *Handing back*).
   Never poll, loop, `tail`, `sleep`, background a wait, re-submit a job to read it, or run `watch.mjs` (KIT-D115).
   Read a result with `node result-summary.mjs <id> --root <tree>`: the verdict, each command's exit code, each failed test
   with its panic location, the DRIVE/summary lines and the log path. Never read a log whole and never `tail` one: repeated
   lines ("Compiling" walls, queued/running ticks) are collapsed to "×N" and cost context for nothing (KIT-D116).
   - `stale` — per failing op: the reason (`not-found`, `ambiguous xN`, `create-exists`),
     the closest current excerpt, `HEAD`, and the commits since your base that touched the
     file. Re-read the file, fix the block, resubmit with `--revises <id>`. Submit refuses these (and
     a byte-identical resubmit of a stale envelope, phase `submit-repeat`) before queueing: exit 1, no id.
   - `gate` — a pre-write check failed (file length, comments, forbidden path); the message
     names it. Fix the patch; nothing touched the tree.
   - `failed` — rustc error blocks keyed by file and the failed test names; fix and resubmit.
     Built in a train (`train` in the result: other queued patches shared the build), `blame`
     says why the failure is yours (a compile error in your file, a test only your patch
     selects or whose module you touched). A blame your patch cannot have caused: resubmit
     unchanged with `--revises`; it rebuilds on the current HEAD.
   - `dirty` — a hand-driven edit holds the tree; the job stays queued. Wait again.

4. **Land** when green: resubmit the same patch with the same `--test` and `--land --ticket
   <id>`; on an unchanged HEAD it lands on the check's evidence without re-running, unless the
   check shared its build with other patches (a train), which leaves no reusable evidence. A confident
   small change may skip the check and submit `--land` first: a red run lands nothing, and under
   `land_gate: affected` the broker gates it on a compile check plus the tests its paths map to,
   with the full suite on a separate cadence (docs/BROKER.md "Fast landing"). The broker
   commits exactly the patch's paths (`<title> (implements <ticket>)`), pushes, and for a
   submodule repo pins the superproject. The result carries `landed.sha`.

## Handing back (KIT-D115, KIT-D116)

No agent spends more than 5 minutes waiting on anything. When the one wait is spent, or your context nears
the ceiling (`dispatch.context_ceiling_tokens`, 300k), write a `Handoff <your agent id>` block in the ticket Notes (`t notes <ticket> "…"`) with the
labelled lines `Jobs:` (job ids), `State:`, `Next:` (the action on pass, fail and stale) and `Files:` (pointers).
Then end with nothing running and report the job ids. The orchestrator watches `target/broker/finished.log`
(one line per finished job: id, verdict, agent, ticket) and resumes you, or briefs a fresh agent from the ticket.
A handoff in a session scratchpad does not count. A job that prints numbers and may fail by design goes in
with `--measure`: it runs in the idle lane and never delays a landing.

## Rules

- Read-only toward the tree: no redirects into it, no `sed -i`, no git writes, no cargo. Write envelope
  files for `submit.mjs < file` with the Write tool under the session scratchpad or system temp dir (the
  pre-write hook refuses the tree).
- Run any script that lives in the tree (python, headless Blender) from a scratchpad copy or with
  `PYTHONDONTWRITEBYTECODE=1`. A stray untracked leftover (`__pycache__`) is cleared with
  `broker.mjs clean <path> | --pycache --root <tree>`; tracked files are deleted by a `*** delete` patch.
- Work-store changes go through `t` / `cap` / `rem`; logs and scratch output are searched with
  `q code <text> --dir <path>`.
- A landing patch needs `--ticket`.
- Two failed revisions of the same problem: stop and report the result ids to the
  orchestrator; it handles stuck patches.
- Check-only runs touch the live tree briefly and restore it byte for byte; the operator
  can `broker pause` / `broker resume` the daemon around hand edits.
