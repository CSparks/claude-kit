---
id: KIT-T392
title: q: search crate sources in the cargo registry (e.g. q code <text> --registry bevy_render-0.19.1) — analysts tracing Bevy internals fall back
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes: KIT-T441
superseded_by:
created: 2026-10-08T03:50:35Z
updated: 2026-10-13T07:21:52Z
---

## Description
q: search crate sources in the cargo registry (e.g. q code <text> --registry bevy_render-0.19.1) — analysts tracing Bevy internals fall back to grep on ~/.cargo/registry (stiletto 2026-10-07, RG-T189)

kit-bug-shape: cap:feature:q-search-crate-sources-in-the-cargo-registry-e-g
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code/sym/file --registry <crate-version|crate> searches a crate in the cargo registry or a vendor dir, absolute paths (scripts/q-registry.test.mjs)
- [x] query-gate redirects a grep of the registry or a vendor dir to the exact q code --registry command (hooks/query-gate.test.mjs)

## Plan
1.

## History
- [2026-10-08 03:50] (created) feature — q: search crate sources in the cargo registry (e.g. q code <text> --registry bevy_render-0.19.1) — analysts tracing Bevy internals fall back
- [2026-10-13 06:48] (comment) @claude: Third hit (2026-10-13, stiletto-2349-68): the RG-T003 force-seam analyst grepped ~/.cargo/registry for avian3d 0.7 / bev (full comment #1 in ## Notes)
### comment #1 [2026-10-13 06:48] @claude
Third hit (2026-10-13, stiletto-2349-68): the RG-T003 force-seam analyst grepped ~/.cargo/registry for avian3d 0.7 / bevy_rapier3d 0.35 / rapier3d 0.25 force-clearing semantics. KIT-T427 and KIT-T441 are the same gap; KIT-T441 superseded by this ticket. Dispatching a sonnet writer in the kit checkout now.
- [2026-10-13 07:21] (comment) criterion added: q code/sym/file --registry <crate-version|crate> searches a crate in the cargo registry or a vendor dir, absolute paths (scripts/q-registry.test.mjs)
- [2026-10-13 07:21] (comment) criterion added: query-gate redirects a grep of the registry or a vendor dir to the exact q code --registry command (hooks/query-gate.test.mjs)
- [2026-10-13 07:21] (comment) ticked: q code/sym/file --registry <crate-version|crate> searches a crate in the cargo registry or a vendor dir, absolute paths (scripts/q-registry.test.mjs)
- [2026-10-13 07:21] (comment) ticked: query-gate redirects a grep of the registry or a vendor dir to the exact q code --registry command (hooks/query-gate.test.mjs)
- [2026-10-13 07:21] (comment) @claude: Tests: scripts/q-registry.test.mjs 13 passed (code hit absolute paths, filters, sym, bare-crate lock resolution, locked  (full comment #2 in ## Notes)
- [2026-10-13 07:21] (status) todo → review

## Notes
Built (KIT-T392): `--registry <crate-version|crate>` on `q code`, `q sym`, `q file` (scripts/q-registry.mjs).
Choice: a direct scan of that one crate directory, no index. A crate is bounded (tens of files), the registry copy never changes, and an index per crate would add a cache to keep fresh for no gain. `q code` reuses the repo verb over an in-memory file list (same filters, rows, ranking); `q sym` extracts symbols from those files in memory (scanSymbols in code-index-query.mjs, which also replaces the old "needs a SQLite engine" dead end). Paths print absolute, forward-slashed.
Resolution: `<crate>-<version>` -> vendor dir (a `vendor/` dir up to 4 levels under the repo, dir `<crate>-<version>` or `<crate>` whose Cargo.toml version matches) then `$CARGO_HOME/registry/src/*/`. A bare `<crate>` -> the one version in the nearest Cargo.lock (cwd upward to the repo root); two locked versions error listing both; absent from the lock -> the single copy on disk, else the candidates are listed.
Gate: hooks/query-gate.mjs rule `registry-grep` (hooks/lib/registry-target.mjs) blocks a recursive grep/rg over a registry or vendor path and prints `node q.mjs code <pattern> --registry <crate-version>`; one named file inside stays allowed. The Grep tool has no gate (telemetry only), so it is not redirected.
The resident server is bypassed for `--registry` (client and server both).
Tests: scripts/q-registry.test.mjs (13: hit, absolute paths, filters, sym, bare-crate lock resolution, locked-version ambiguity, on-disk ambiguity, absent crate, pre-release dir, vendor, CLI end to end, server bypass); hooks/query-gate.test.mjs (+8 registry/vendor cases incl. redirect text).
### comment #2 [2026-10-13 07:21] @claude
Tests: scripts/q-registry.test.mjs 13 passed (code hit absolute paths, filters, sym, bare-crate lock resolution, locked and on-disk version ambiguity errors, absent crate, vendor, CLI, server bypass); hooks/query-gate.test.mjs 78 PASS 0 FAIL (registry and vendor redirect text, one-file allowed); q.test 109, code-index.test 23, q-server 8, cli-help 18, search-adoption 7, index-redirect 44 passed. Full package.json chain: 97 commands, 5 fail, all 5 fail identically at HEAD (db-cache similar-parity, dispatch-broker, activity-tag, server.test) or were a transient during a docs edit (search-adoption, passes on rerun).
