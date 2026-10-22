---
id: KIT-T622
title: broker: dirt-empire lane jobs run 569-646 s wall for a single test target (vehicle_golden, 5 tests in 8-16 s) on 2026-10-22: jobs j-mvjnw8rf
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: [KIT-D104, KIT-D105]
files: []
supersedes:
superseded_by:
created: 2026-10-22T16:03:06Z
updated: 2026-10-22T21:47:30Z
---

## Description
broker: dirt-empire lane jobs run 569-646 s wall for a single test target (vehicle_golden, 5 tests in 8-16 s) on 2026-10-22: jobs j-mvjnw8rf, j-mvjp03in, j-mvjpqljj each rebuild DE cold after a rapid-game pin bump; violates KIT-D104 5-minute ceiling. Expected: warm incremental target across consecutive DE jobs.

kit-bug-shape: cap:bug:broker-dirt-empire-lane-jobs-run-569-646-s-wall-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Cargo build-shaped broker commands and pre-push gates take a machine-wide build slot in arrival order, shared across checkouts
- [x] A slot or ticket of a dead process is reclaimed; a cancelled waiter leaves no ticket
- [x] Command results carry slotWaitMs and the over-ceiling report names queued minutes
- [x] Broker test suite passes

## Plan
1.

## Notes
ROOT CAUSE (2026-10-22, measured). Not a cold or per-job target: one shared D:/dev/dirt-empire/target; a lib-only touch recompiles dirt-empire in 3.6 s. The cost is cargo test --test X building ALL 8 units of the package (the test + 7 bins) in one link wave. Same command, same target, lib touched: stiletto broker building (16:55-17:07 UTC) -> wave 167-221 s per unit, job 3m45s (cargo-timings 20261022T165920984Z); stiletto idle -> wave 10-21 s, job 1m14s incl. rg-physics + lib rebuild (20261022T171301704Z). Every slow DE job (14:39 504s, 15:01 576s, 15:25 638s, 15:49 654s) overlaps a stiletto-2349 job of 12-53 min (results/*.json startedAt/finishedAt); the 63 s warm job and the 177 s compile-error job did not. Mechanism: jobs.mjs sizes -j for the WHOLE machine (min(cores, RAM/4GiB) = 15 here) per broker, so N brokers = N x 15 rustc/lld on 63 GiB: pagefile pressure, 10x slower links, and the gate V8 abort (KIT-T621). FIX: scripts/broker/build-slot.mjs machine-wide FIFO build slots (floor(autoJobs/jobs) slots) around every cargo build-shaped command and pre-push gate. Residual DE-side cost not fixable in the kit: cargo links all 7 bins for any --test (about 20 s each alone); gating the 6 tool bins behind required-features in crates/dirt-empire/Cargo.toml would cut a DE test job by about 2.5 min.
KIT-D097 CONFLICT (settled 2026-10-17, directive: nothing locks or waits across directories). The fix that removes the contention (machine-wide FIFO build slot, one cargo build at a time per box) is exactly what D097 forbids and scope-invariants.test.mjs enforces, so it was built, caught by that test, and backed out; patch kept at C:/Users/CHRISS~1/AppData/Local/Temp/claude/D--dev-dirt-empire/3da4b4ee-a172-4e14-a3e1-a83b9e906775/scratchpad/machine-build-slot.patch (build-slot.mjs, run/run-cancellable/prepush wiring, 8 tests). Needs Chris: (A) amend D097 to allow a machine build budget; (B) D097-compatible soft fix with no lock or wait: size auto -j from memory free now (os.freemem) per command instead of total RAM; (C) DE-side: crates/dirt-empire/Cargo.toml required-features on the 6 tool bins so --test stops linking 7 unused executables (about 2.5 min per DE test job). Status left todo until decided.
RULED 2026-10-22 (Chris, all three options): decision KIT-D105 narrows KIT-D097 to allow exactly one cross-directory wait, the machine build slot; scope-invariants.test.mjs asserts that exception and nothing wider (3 tests). Option 3 (DE bins behind required-features) landed in dirt-empire as 9261b1c. MEASURED (scratchpad contend.mjs; synthetic load = 200 s alone bevy rebuild in a separate target, DE = lib-touch + vehicle_golden --no-run, after bins were gated): no slot, DE beside load 112.6 / 148.6 / 40.0 s; with slot DE queued 129.3 s then ran 66.9 s (196.5 s total), load unslowed 174.8 s. Makespan with slot 244 s vs 188-219 s raw: the slot trades throughput for predictability when jobs are light; it wins when jobs are heavy link waves (same command with 7 bins: 3m45s contended vs 1m14s alone). Option 2 (free-memory -j) NOT shipped: idle box shows 13-18 GiB free so it would pick -j 3-4 always; solo bevy rebuild takes 353 s at -j 3 vs 200 s at -j 15 (1.77x slower), against a gain only under non-broker load (DE 100 s mean -> 37 s, n=3, noisy). Broker suite: 480 pass 0 fail.

## History
- [2026-10-22 16:03] (created) bug — broker: dirt-empire lane jobs run 569-646 s wall for a single test target (vehicle_golden, 5 tests in 8-16 s) on 2026-10-22: jobs j-mvjnw8rf
- [2026-10-22 17:33] (status) todo → doing
- [2026-10-22 17:36] (comment) criterion added: Cargo build-shaped broker commands and pre-push gates take a machine-wide build slot in arrival order, shared across checkouts
- [2026-10-22 17:37] (comment) criterion added: A slot or ticket of a dead process is reclaimed; a cancelled waiter leaves no ticket
- [2026-10-22 17:37] (comment) criterion added: Command results carry slotWaitMs and the over-ceiling report names queued minutes
- [2026-10-22 17:37] (comment) criterion added: Broker test suite passes
- [2026-10-22 18:44] (status) doing → todo
- [2026-10-22 21:47] (comment) ticked: Cargo build-shaped broker commands and pre-push gates take a machine-wide build slot in arrival order, shared across checkouts
- [2026-10-22 21:47] (comment) ticked: A slot or ticket of a dead process is reclaimed; a cancelled waiter leaves no ticket
- [2026-10-22 21:47] (comment) ticked: Command results carry slotWaitMs and the over-ceiling report names queued minutes
- [2026-10-22 21:47] (comment) ticked: Broker test suite passes
- [2026-10-22 21:47] (status) todo → done
