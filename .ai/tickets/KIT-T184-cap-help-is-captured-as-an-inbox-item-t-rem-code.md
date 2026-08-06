---
id: KIT-T184
title: cap --help is captured as an inbox item; t / rem / code-graph have no help path either
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:02:25Z
updated: 2026-08-06T02:11:06Z
---

## Description
Asking a kit CLI for usage got whatever its arg parser did with an unknown token. Measured
2026-08-05/06:

    cap --help        -> wrote .ai/inbox/2026-08-06-0152-help.md, body "--help"  (receipt: "captured")
    t --help          -> "t: unknown subcommand '--help'" + usage
    t new --help      -> "unknown type '--help'"
    rem --help        -> "rem: unknown verb '--help'. usage: …"
    code-graph --help -> built the whole graph and dumped it as JSON

cap's is the damaging one: a discovery attempt WROTE to the work store, and the inbox is the
triage queue, so the junk file then needs triaging. Only `q` had a real help path (KIT-T083 /
KIT-T118) — and the query-gate block message tells agents to run `q --help`, which is exactly
why the other four needed the same contract.

Root cause: no shared definition of "the caller asked for usage", so every CLI leaked the flag
into its payload. Note the reason it cannot simply be "any arg equal to --help": cap's payload is
FREE TEXT, so the flag counts only in first position there, while the structured CLIs (t, rem,
code-graph) honor it anywhere.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] cap --help prints usage to stdout, exits 0, and writes NOTHING into the store
- [x] t / rem / code-graph answer --help and -h with their own usage on stdout, exit 0, no unknown-argument error
- [x] code-graph --help does not build the graph
- [x] a capture whose free text contains a help flag is still captured (no false help path)
- [x] scripts/cli-help.test.mjs covers all five CLIs and is wired into npm test

## Plan
1. scripts/cli-help.mjs — one spelling of the flag (`isHelpFlag`), one predicate for structured
   CLIs (`wantsHelp`, anywhere) and one for free-text CLIs (`wantsHelpFirst`, first position).
2. cap / t / rem / code-graph each print their OWN usage to stdout and exit 0 on the flag.
3. scripts/cli-help.test.mjs drives all five CLIs (q included, as the reference) plus the two
   repros: cap --help writes nothing, and cap still captures prose containing a flag.

## History
- [2026-08-06 02:02] (created) bug — cap --help is captured as an inbox item; t / rem / code-graph have no help path either
- [2026-08-06 02:11] (comment) criterion added: cap --help prints usage to stdout, exits 0, and writes NOTHING into the store
- [2026-08-06 02:11] (comment) criterion added: t / rem / code-graph answer --help and -h with their own usage on stdout, exit 0, no unknown-argument error
- [2026-08-06 02:11] (comment) criterion added: code-graph --help does not build the graph
- [2026-08-06 02:11] (comment) criterion added: a capture whose free text contains a help flag is still captured (no false help path)
- [2026-08-06 02:11] (comment) criterion added: scripts/cli-help.test.mjs covers all five CLIs and is wired into npm test
- [2026-08-06 02:11] (comment) ticked: cap --help prints usage to stdout, exits 0, and writes NOTHING into the store
- [2026-08-06 02:11] (comment) ticked: t / rem / code-graph answer --help and -h with their own usage on stdout, exit 0, no unknown-argument error
- [2026-08-06 02:11] (comment) ticked: code-graph --help does not build the graph
- [2026-08-06 02:11] (comment) ticked: a capture whose free text contains a help flag is still captured (no false help path)
- [2026-08-06 02:11] (comment) ticked: scripts/cli-help.test.mjs covers all five CLIs and is wired into npm test
- [2026-08-06 02:11] (status) todo → review
- [2026-08-06 02:11] (comment) fixed: scripts/cli-help.mjs + help paths in cap/t/rem/code-graph. Evidence: scripts/cli-help.test.mjs 16 passed, 0 failed; cap 16 passed; t 83 passed; rem 36 passed; code-graph 33 passed.
