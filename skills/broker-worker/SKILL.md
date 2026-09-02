---
name: broker-worker
description: Work a ticket as a build-broker worker — edit in a cheap git worktree (never build), commit with explicit paths, submit a job to the shared broker, wait for the result, and land through it. Use when many agents share one build checkout via the broker (scripts/broker/) instead of each spinning up its own environment.
---

# broker-worker — edit in a worktree, verify + land through the broker

The broker (`scripts/broker/broker.mjs`) owns the one build checkout and its shared
`CARGO_TARGET_DIR`; it is the ONLY thing that runs cargo there. You are a worker: you
edit in a cheap worktree, commit, and hand the broker a JOB. You never build. This buys
one warm build, one writer on main, and a linear verified history across N workers.

Operator setup + schemas: `docs/BROKER.md`. Read it if you are also starting the broker.

## The loop

1. **Claim a worktree** off the build checkout, on your own lane branch (one ticket per
   branch). Superproject work:
   ```
   git -C <build-checkout> worktree add <wt> -b lane/<ticket> main
   ```
   Submodule work (the branch lives in the submodule — the broker re-pins the
   superproject on land):
   ```
   git -C <build-checkout>/rapid-game worktree add <wt> -b lane/<ticket> main
   ```
   If a superproject worktree must see the submodule, init it there (you still never
   build it): `git -C <wt> submodule update --init rapid-game`.

2. **Edit in the worktree.** Do NOT run cargo here — a fresh worktree has no `target/`,
   so a build would compile the whole graph cold. Verification is the broker's job.

3. **Commit with explicit paths** — never `git add -A`, never `git commit -a`. Stage the
   files you changed by pathspec so nothing unrelated rides along:
   `git -C <wt> add <paths> && git -C <wt> commit -m "… (implements <ticket>)"`.
   Need a scratch baseline? Use a WIP commit, not `git stash` (the stash stack is shared
   across worktrees and the hook blocks it).

4. **Submit a CHECK-ONLY job early** (no land) to get a green signal cheaply:
   ```
   id=$(node <kit>/scripts/broker/submit.mjs --root <build-checkout> \
     --repo <stiletto|rapid-game> --branch lane/<ticket> \
     --command "cargo test -p <crate> --lib" --ticket <ticket> --title "<title>")
   node <kit>/scripts/broker/wait.mjs $id --root <build-checkout>
   ```
   `wait` blocks on the result and EXITS with the job status (0 passed, 1 failed/conflict/
   dirty, 2 timeout), so your turn is never left stopped on a background task. Omit
   `--command` to run the repo's `verify_default`.

5. **Read the result, fix, resubmit.** On `failed` the result carries each command's exit
   code and the last ~60 log lines; on `conflict` it lists the paths — rebase your lane on
   main in the worktree (`git -C <wt> rebase main`), fix, recommit, resubmit.

6. **Land** once green: submit again with `--land`. The broker rebases onto main,
   re-verifies, then `merge --ff-only` + push, deletes your branch, and (for a submodule
   job) re-pins the superproject with a pathspec-only commit.
   ```
   id=$(node <kit>/scripts/broker/submit.mjs --root <build-checkout> --repo <repo> \
     --branch lane/<ticket> --command "cargo test -p <crate>" --land \
     --ticket <ticket> --title "<title>" --worktree <wt>)
   node <kit>/scripts/broker/wait.mjs $id --root <build-checkout>
   ```
   `--worktree <wt>` lets the broker free your branch on a green land (it removes the
   worktree, then deletes the branch). Default is the current directory.

7. **Confirm teardown.** After a green land your worktree and branch are gone. If a land
   did not happen (red/conflict), your worktree stays — clean it yourself when done:
   `git -C <build-checkout> worktree remove <wt>`.

## Rules

- **Never run cargo in a worktree.** The broker holds the only warm build.
- **Explicit-path commits only** — no `-A`, no `-a`. The broker's submodule re-pin refuses
  if anything but the pointer is staged; keep your superproject commits just as tight.
- **One ticket per lane branch.** `lane/<ticket>`.
- **Rebase, don't merge**, when the broker bounces a conflict. Linear history is the point.
- **Coexisting with a hand-driven writer:** the broker only runs on a CLEAN build checkout.
  If your job comes back `dirty`, someone is editing the checkout directly — it re-queues
  and runs once they leave it clean and say "checkout free".

## Dispatch-guard interplay (for whoever spawns workers)

Workers run with `isolation: worktree` in a Rust workspace, which the kit's dispatch-guard
gates. Because a worker never builds, the guards' cost rationale does not apply — clear
them explicitly in the dispatch prompt:

- **cold-worktree-build**: include `[cold-build-ok: broker worker — never runs cargo; the
  broker owns the only build]`.
- **parallel-dispatch** (blocks a 2nd agent in a Rust workspace): to run N workers, state
  the cost — `[allow-parallel: N lanes, ~Xk tokens each, broker serializes all builds;
  workers only edit — no compile contention]`.
- **shared-tree-dispatch** does not fire for worktree isolation (each worker has its own
  checkout).

Do NOT weaken the guards themselves — these tokens are the sanctioned, logged escape.
