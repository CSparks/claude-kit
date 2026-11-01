---
id: KIT-Q005
status: resolved
answerable_by: chris   # chris | claude  (see config.yml classifications.question)
created: 2026-10-31T00:38:49.213Z
---

**Q:** Which waste levers may the timing controller apply on its own (KIT-D121), given what the broker now measures?

Measured on dirt-empire, 914 jobs (root and rapid-game lanes), read from results and cargo logs:
- The largest named cause of a crate compiled twice in one job is `cargo check` followed by `cargo t` with different flags: 5294 s of 83217 s total compile (and 11.4 min in the last 24 h of the root lane). dirt-empire's land gate runs `cargo check --offline --workspace --all-targets --features dirt-empire/tools`; its tests run without that feature, so cargo builds dirt-empire and its dependencies twice (check emits metadata only, and the feature sets differ).
- Test commands for crates the change does not reach (rg-physics, rg-vehicle test runs in a dirt-empire patch): `scope` waste, 7 min for rg-physics --lib alone in 24 h.
- Unneeded rebuilds of rg-vehicle, rg-physics, vehicle, look: 4-7 min each in 24 h; not caused by RUSTFLAGS flips (the broker sets none), by lane target dirs (one shared dir) or by pin bumps (now excluded). The dirty reason cargo gives is not in the logs; finding it needs a live probe between jobs.
- Only 50 of 382 root-lane cargo commands compiled nothing.

Levers and what each changes:
(1) Feature-set normalisation per lane. A: run the land gate's check with the feature set the lane's tests use and run the `tools` feature check on the nightly slot. B: add the check's `--features` to the tests (tests then compile editors they do not use). C: leave. A removes the repeat but a landing no longer compiles `tools` until the nightly run.
(2) Test re-scoping. A: advisory only, the result names commands outside the reach. B: skip such a command when the same job also ran the tests the change reaches, logged and measured. C: never. B runs fewer tests than the worker asked for.
(3) Warm-build reuse across queued jobs. Restoring a file's old mtime after a patch restore is unsafe: cargo would reuse an artifact built from the patched bytes for the restored bytes. A safe version needs a second check tree per lane and a separate target dir (a cold build once, then no thrash between patched and base). Costs disk and a cold build.

Recommend: (1) A, (2) A now and B once the advisory data shows the skipped commands never failed, (3) hold until the live cargo probe names the dirty reason, since a second tree may not remove the cause.

**Resolution:** (2026-10-31, chris) Maintainer 2026-10-30: (1) A, the land-gate check uses the lane's test feature set, and the tools-feature check moves to a scheduled run. (2) A then B: advisory flags first; auto-skip, logged and measured, once the flagged runs are shown never to fail. (3) Live cargo probe to name the dirty reason first; decide on a second check tree only after that.

<!-- One question per file (atomic — KIT-D009). IDs KIT-Q### (e.g. KIT-Q001). Claude answers
     the answerable_by: claude ones from code/decisions and sets status: resolved; chris-only
     ones are surfaced batched at natural breaks. Allocate ids with next-id.mjs (KIT-T009). -->

## History
- [2026-10-31 00:58] (resolved) chris
