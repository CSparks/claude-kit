---
id: KIT-D053
title: DB & ORM discipline moves from the contract to a kit skill
date: 2026-08-05
supersedes:
source: conversation 2026-08-05 ("DB-to-skill is the right path.")
---

**Decision:** The DATABASE & ORM DISCIPLINE section leaves the global contract and
becomes the kit skill `skills/db-discipline/` (full original checklist, uncompressed).
The contract keeps one line under DEVELOPMENT PRINCIPLES: load `db-discipline` before
any DB code.

**Why:** The checklist fires only when writing DB code, and the hard violations
(SELECT *, string-built SQL, empty downgrades) are hook-enforced ambiently — the
per-engine defaults don't need to ride in every session's context. Accepted risk: the
defaults are no longer ambient; mitigated by the contract pointer line + hook coverage
of the top three.
