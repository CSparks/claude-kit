---
id: KIT-D105
title: One build per machine - the machine build slot is the only cross-directory wait a broker may take
summary: Narrows KIT-D097. Every broker takes a first-come machine build slot around each cargo build-shaped command and pre-push gate; nothing else locks or waits across directories.
date: 2026-10-22
supersedes: 
source: Chris 2026-10-22 (questionnaire in the dirt-empire session, KIT-T622)
---


**Decision:** Chris chose "Amend KIT-D097: one build per machine". A broker takes a machine build slot (`scripts/broker/build-slot.mjs`) around every cargo build-shaped command and every pre-push gate, granted in arrival order across ALL checkouts and repos on the box. The box has floor(auto jobs / the command's -j) slots, one where -j already fills it. The slot directory is `~/.claude/claude-kit-build-slots` (`CLAUDE_KIT_BUILD_SLOT_DIR` moves it).

**Scope:** the build slot is the ONLY cross-directory wait. Every other KIT-D097 guarantee stands: per-directory queue, lock and state; no machine-wide push lock; Rust build inputs only; lanes do not block each other's edits; no orphaned commits; one pre-push gate per push. `scope-invariants.test.mjs` exempts exactly `build-slot.mjs` for its slot directory and fails any other module that builds a path outside the checkout.

**Why:** each broker sized `cargo -j` for the whole machine, so brokers of different checkouts multiplied it. Measured 2026-10-22 on one command (dirt-empire `cargo test --test vehicle_golden --no-run`, lib touched): 3m45s with a stiletto build running, 1m14s with it idle; the 8-unit link wave took 167-221 s per unit versus 10-21 s. A gate hook aborted at a 7 MB heap when memory ran out (KIT-T621). Waiting a turn costs less than running at a tenth of the speed. KIT-T622.

**Rejected:** a cheaper -j alone (still lets two brokers build at once); a lock keyed to the target dir (stiletto and dirt-empire use different ones).
