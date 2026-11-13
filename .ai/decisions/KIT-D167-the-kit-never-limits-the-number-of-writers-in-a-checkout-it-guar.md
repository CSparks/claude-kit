---
id: KIT-D167
title: The kit never limits the number of writers in a checkout; it guards a same-file write and a write into a running build
summary: any number of writers share a checkout; dispatch refuses only overlapping declared [paths:]; the write guard refuses a file another live agent changed and has not committed and a build input of a crate another writer's cargo build is compiling; a [tree:] at another project needs its ticket or the maintainer's words
date: 2026-11-13
supersedes: KIT-D077, KIT-D144 (the one-writer limit), amends KIT-D155 (its per-file rule now holds in every checkout)
source: conversation 2026-11-13 (Chris, via the road-generator orchestrator), KIT-T1114
---


**Maintainer:** "The aim was NEVER to stop multiple fucking writers." "The aim was to stop MULTIPLE WRITERS ON THE SAME FUCKING FILE OR WHILE A BUILD WAS RUNNING." "WHY THE FUCK IS THE NUMBER OF WRITING AGENTS EVEN FUCKING LIMITED. THE ONLY FUCKING FACTOR IS IF A FUCKING WRITE FUCKS WITH A BUILD." Of an orchestrator that borrowed other games' checkouts as scratch copies of a framework: stupid.

**Decision:**
1. Writer count per checkout is never limited. shared-tree-dispatch allows a second writer. A writer dispatched while another is in flight in the checkout declares `[paths: ...]` (alone it needs none; `[paths: *]` is not a declaration) and is refused only when its paths overlap an in-flight writer's. `[maintainer-asked-parallel: <his words>]` remains the override for an overlap. An in-flight writer that declared no paths blocks no one; the per-file guard protects it.
2. checkout-holder judges every checkout per file, as KIT-D155 did for the kit checkout: a writer dispatch or an edit is refused only when another live session has uncommitted changes to the file.
3. The write guard (holder-beat.mjs) refuses an Edit or Write to a file another live agent of the same session changed and has not committed (per-writer claims; ends when the agent stops, the file is committed, or 2 h without a write), naming that agent. An agent's own files always pass.
4. The write guard refuses another writer's Edit or Write to a build input (`.rs`, `Cargo.toml`, `Cargo.lock`, `.cargo`, toolchain files) inside the paths a running cargo build compiles. The build-budget hold records those paths (packages named by `-p`, `--workspace`, or the member holding the working directory, plus their path dependencies, from `cargo metadata --offline`) and the starting writer (CLAUDE_KIT_BUILD_WRITER, exported by the build-wrap hook). The edit is refused with "retry after the build", never queued or waited. A hold in its test phase, a hold with no recorded scope, the build's own writer and every other file pass.
5. A `[tree: X]` that is another registered project's checkout needs a brief citing a ticket of that project, unless the prompt carries `[maintainer-asked-tree: <his words>]`. A checkout inside the session's own, an unregistered root and a read-only dispatch are not judged.

**Why:** the one-writer limit kept the guard simple and priced the wrong thing; the harm is two edits to one file and a build compiling half of two edits. Counting writers pushed an orchestrator to copy a framework into other games' checkouts.

**Rejected:** a writer with no `[paths:]` owning the whole tree (that rebuilds the count limit); a global per-tree lock; waiting a write behind a build (hooks never wait, KIT-D115).

**Assistant-added:** Residuals: the session ledger cannot tell two agents of one session apart, so the same-session test rests on the new per-writer claims; a workspace whose root is itself a package scopes the whole root; the commit-foreign gate stays per file only in the kit checkout; local-agent slots keep their one-direct-writer rule. Related KIT-T482, KIT-D123, KIT-D144, KIT-D155.
