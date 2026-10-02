---
name: patch-worker
description: Work a ticket as a broker patch worker — read the tree, author the change as a search/replace patch, submit it to the shared broker daemon on stdin, wait for the result, revise on stale/gate/failed, then land through the broker. Use when a project's broker daemon owns the checkout (target/broker/broker.lock is live) and many agents queue patches instead of editing.
---

# patch-worker — queue patches, never write the tree

The broker daemon (`scripts/broker/broker.mjs`) is the ONLY writer in the checkout. It
applies your patch, runs the kit's pre-write gate on every file, builds and tests with the
one warm `CARGO_TARGET_DIR`, and with `--land` commits by explicit paths and pushes. You
have no Edit/Write tool and never run cargo. Operator setup + schemas: `docs/BROKER.md`.

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
   PATCH
   )
   node <kit>/scripts/broker/wait.mjs $id --root <tree>
   ```
   - An `edit` block applies while its SEARCH text matches exactly once. Include enough
     context lines to be unique. One `*** edit` header may carry several blocks.
   - `write` creates a new file; it refuses a path that already exists.
   - `--test` is repeatable; omit it to run the project's `verify_default`. Use the
     project's cargo aliases (`cargo t`, `cargo b`); the broker adds `-j` and
     `--no-fail-fast`.
   - `--repo rapid-game` targets the submodule; paths are relative to it.

3. **Read the result.** `submit` itself answers a stale dry run in seconds (JSON on stdout,
   exit 1). `wait` exits 0 for passed/landed, 1 otherwise, 2 on timeout (it prints your
   queue position; wait again).
   - `stale` — per failing op: the reason (`not-found`, `ambiguous xN`, `create-exists`),
     the closest current excerpt, `HEAD`, and the commits since your base that touched the
     file. Re-read the file, fix the block, resubmit with `--revises <id>`.
   - `gate` — a pre-write check failed (file length, comments, forbidden path); the message
     names it. Fix the patch; nothing touched the tree.
   - `failed` — rustc error blocks keyed by file and the failed test names; fix and resubmit.
   - `dirty` — a hand-driven edit holds the tree; the job stays queued. Wait again.

4. **Land** when green: resubmit the same patch with `--land --ticket <id>`. The broker
   commits exactly the patch's paths (`<title> (implements <ticket>)`), pushes, and for a
   submodule repo pins the superproject. The result carries `landed.sha`.

## Rules

- Read-only: no redirects into the tree, no `sed -i`, no git writes, no cargo.
- A landing patch needs `--ticket`.
- Two failed revisions of the same problem: stop and report the result ids to the
  orchestrator; it handles stuck patches.
- Check-only runs touch the live tree briefly and restore it byte for byte; the operator
  can `broker pause` / `broker resume` the daemon around hand edits.
