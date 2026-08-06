---
id: KIT-N004
title: Process failure — a kit-level fact was duplicated per-project because only the NEGATIVE was searched
created: 2026-08-06
links: [KIT-D046, KIT-T196]
---

2026-08-05: wrote jollys-vinyl JV-D006 restating the GitHub account-of-record fact that had been in
the durable record at kit level since 2026-08-02 (**KIT-D046**) — a second, project-scoped copy of
cross-project knowledge, which is the anti-pattern the base contract names.

Root cause: grounded on the NEGATIVE only. The JV store was searched for the stale term
(`depixeled-chris`, which surfaced JV-Q003) and a new decision was written without ever querying for
the POSITIVE fact ("account of record"), and without querying the KIT scope at all. Note the
retrieval shape that makes this easy: `q fts` defaults to the CWD project's scope (KIT-T174), so a
kit-level decision is invisible from a project session unless `--scope all` is passed — the same
cross-store blindness KIT-T196 covers for the request gate.

Antidote when about to record a cross-cutting fact: search for the fact you intend to WRITE, not
just the wrong version you are correcting, and search `--scope all` before writing a decision that
could already exist at kit level.

Provenance: `.ai/inbox/triaged/2026-08-05-1838-process-failure-duplicated-kit-d046-as-a-per-pro.md`.
