---
id: KIT-T1275
title: pre-write: refuse the first file of a new folder that a Cargo workspace takes as a member by glob (members = ["world/*"]) unless that file i
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T19:08:35Z
updated: 2026-11-15T19:30:34Z
---

## Description
pre-write: refuse the first file of a new folder that a Cargo workspace takes as a member by glob (members = ["world/*"]) unless that file is its Cargo.toml and a src/lib.rs or src/main.rs is written in the same message. Root cause seen 2026-11-15 in road-generator (RDG-T084): an agent wrote rapid-game/rust/world/rg-landrecord/src/geom.rs first; a glob member folder with no manifest made every cargo command in the workspace fail ('failed to load manifest for workspace member') for every agent until the folder was removed; and a manifest written one call before its lib.rs made a concurrent build's write-guard scope widen to the whole workspace (cargo metadata failed at that instant). Prevention wanted: the gate names the glob and the two files to write together.

kit-bug-shape: cap:feature:pre-write-refuse-the-first-file-of-a-new-folder-:dc866001
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 12c7547 (runtime 12c7547). hooks/lib/crate-folder-gate.mjs, called from pre-write.mjs before the store-write check: a Write that would create a file (the file does not exist) walks up to the nearest Cargo workspace; it is refused when an ancestor folder between the file and the workspace root matches a members pattern (literal, star, double star, question mark), is not matched by exclude, has no Cargo.toml, and the file is not that folder Cargo.toml. The refusal names the folder, the workspace and the member pattern and says to write the crate Cargo.toml first, with its src/lib.rs or src/main.rs in the same message. A workspace or glob it cannot read (a character class, an unreadable manifest, no members, a package that is no workspace, a path in no workspace) judges nothing; the crate-folder ignore key (or in-source marker) lifts it. Tests: hooks/crate-folder-gate.test.mjs 19 passed (src file, direct file and README as first file, a literal member, a double-star member refused; the manifest first, then the crate own files, an existing crate, an excluded folder, a non-member folder, the workspace root, the ignore key, fail-open forms pass), mutation-checked (the manifest exemption); pre-write 75, pre-write-comment-state 7. Not done: the second symptom in the ticket (a manifest written one call before its lib.rs widens a concurrent build scope to the whole workspace for that instant) is not guarded; the refusal tells the writer to send the manifest and the source file in one message.

## History
- [2026-11-15 19:08] (created) feature — pre-write: refuse the first file of a new folder that a Cargo workspace takes as a member by glob (members = ["world/*"]) unless that file i
- [2026-11-15 19:30] (landed) 12c7547 pre-write refuses the first file of a folder a Cargo workspace takes as a member when the folder has no Cargo.toml and t
- [2026-11-15 19:30] (status) todo → review
