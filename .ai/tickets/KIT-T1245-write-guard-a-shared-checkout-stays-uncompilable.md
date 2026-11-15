---
id: KIT-T1245
title: write guard: a shared checkout stays uncompilable for minutes at a time because agents end a tool round with a crate half edited (rg-townpla
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes: KIT-T1247
superseded_by:
created: 2026-11-15T08:56:08Z
updated: 2026-11-15T08:56:08Z
---

## Description
write guard: a shared checkout stays uncompilable for minutes at a time because agents end a tool round with a crate half edited (rg-townplan fences, rg-buildings roof_items PLANT_SCREEN, rg-graphics CloudLayer haze_m, rdg-world held_ground: five incidents in one session on 2026-11-15, each blocking other agents' checks and launch checks). The brief rule (define before use, check after each edit) is not holding. Wanted: after an agent's Edit or Write round on a Rust crate, a cheap per-crate cargo check (or rustc parse plus name resolution) owned by the kit that tells THAT agent at once its crate no longer compiles, and a per-crate broken marker other agents can read (q builds broken) naming the agent that broke it, so a blocked agent knows whom it waits on instead of failing a check four times.

kit-bug-shape: cap:feature:write-guard-a-shared-checkout-stays-uncompilable:5d00b1d5
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built the smaller design (advisor-reviewed): no hook-started cargo check (a kit check would take a build slot and its scope hold would refuse every other writer's edit into the crate, half-batches would read as broken, and KIT-D162/D104 forbid implicit builds). Instead hooks/lib/broken-crates.mjs: a failed cargo check by anyone marks the crate (first error, last writer off the accepted-writes ledger, since); a passing check whose scope covers the crate clears it; the blocked writer's failed check prints whom it waits on; the last writer hears at its next tool call of any kind (hooks/broken-crate-notice.mjs, once per marker) and at SubagentStop; `builds` / `builds --broken` list broken crates; holder-beat's build-hold refusal names every crate the writer left unchecked or broken (KIT-T1247) and never refuses the last writer of a marked crate (the repair edit, KIT-T1249). Why KIT-T1211 did not prevent the incidents: the road-generator turnstate has no cratechecks record at all (the hook was wired by plugin 0.1.47 on 2026-11-14 evening; the sessions started earlier and never loaded it), and it only nudged at SubagentStop and blamed a live claim on the exact error file. Tests: hooks/broken-crates.test.mjs 24 passed, hooks/crate-check.test.mjs 18, hooks/build-write-hold.test.mjs, scripts/broker/build-status.test.mjs, scripts/plugin-compat.test.mjs 159. Limit: a marker exists only after some writer's check fails; a half-edited crate nobody checks stays unmarked (the breaker is still told at stop). New PostToolUse entry needs /plugin update (0.1.53) and a reload.

## History
- [2026-11-15 08:56] (created) feature — write guard: a shared checkout stays uncompilable for minutes at a time because agents end a tool round with a crate half edited (rg-townpla
