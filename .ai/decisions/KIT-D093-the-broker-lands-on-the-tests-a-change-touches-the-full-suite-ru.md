---
id: KIT-D093
title: The broker lands on the tests a change touches; the full suite runs on its own cadence and never rewrites the tree
summary: land_gate affected (workspace check + mapped targets + the worker's commands), green-check reuse, baseline cache, -j auto; full suite + release probe run idle every suite_every landings, a red files a regression with the range and an inferred causing_commit
date: 2026-10-14
supersedes: 
source: Chris 2026-10-14 02:20–02:35 (KIT-T472, verbatim below); built a2214aa, 1f0dbc3, 822a601, 1dc46ff, 555dd24, fffca34; refines KIT-D087
---


**Decision:**
- **Landing gate:** with `land_gate: affected`, a landing runs `cargo check --workspace --all-targets`, the `--lib/--test/--bin` targets mapped from its changed paths, and the worker's targeted commands. Full-suite-shaped commands leave the gate. A `.rs` or `Cargo.toml` outside every crate falls back to the job's own commands. A deleted bin or test picks no target (KIT-T475).
- **Reuse:**
  - A `--land` whose HEAD, tree, patch, pins and commands match a passed check-only run lands on that run's evidence (`reusedFrom`).
  - The attribution baseline is cached by pre-patch tree, held pins and command.
- **Parallelism:** `jobs: auto` is every core the RAM feeds at 4 GiB a job. A number still pins it.
- **Full suite:** it runs on the committed HEAD while the queue is idle, every `suite_every` landings, and yields to queued jobs.
  - A red files one `cap regression` per failing set, naming the range since the last green run, the failing tests and the landing whose paths map to them (`causing_commit`, provenance: inferred).
  - It never checks out or rewrites the tree.
- **Evidence (KIT-T061):** the result JSON lists the commands, exit codes and selection reasons. The commit carries a `Broker-Gate:` trailer, and `suite/<sha>.json` is the full-suite record.

**Why:** Chris 2026-10-14:
- "If this means improving the caching of the one writer many worker system, we should do it."
- "Getting changes in at speed is more important than I'm blocking those changes by tests. Tests can accumulate and run separately, but there should be a much more efficient way to do this that allows for a quicker turnaround on a multi agent set up."
- "we need to make this process less slow."

Measured over 139 dirt-empire jobs (35,445 s): leaf-crate builds took 48 %, baseline re-runs 18 %, and the check-then-land duplicate 11 %. The projected saving is about 31 % of broker time.

**Rejected:**
- Bisecting a red suite by materialising old commit trees in the checkout: it rewrites the maintainer's live tree under working patch-workers.
- Scratch or fixture copies of the repo: "this multiple copies shit is what I was trying to avoid when I instantiated the one writer policy" (Chris, same night).
