---
name: db-discipline
description: The DB & ORM checklist — mandatory before writing ANY database code (SQL, schema/migrations, Drizzle, Alembic, ORM queries). Load it the moment DB work appears; the hooks enforce the top violations, this skill carries the full per-engine defaults.
---

# Database & ORM discipline

Run this checklist before writing any DB code. Moved here from the global contract
(KIT-D053) — the hooks enforce the hard violations ambiently; this skill is the full
reference and MUST be loaded whenever DB work starts.

## Queries
- **No SELECT \*** — enumerate columns always (hook blocks this).
- **No string-built SQL** — parameterize always. f-strings, template literals, and
  concatenation containing SQL keywords are injection-shaped (hook warns; human review
  required).
- **ORMs in loops** — prevent N+1. Load relations eagerly with `with:`/`joinedload`/
  `selectinload`.
- **Transactions** — keep scope tight. Never hold a transaction across a network call
  to a third party.

## Schema
- **Every new table gets**: PK, `created_at timestamptz` (Postgres) / `DATETIME`
  (SQLite/MySQL), indexes on all FKs, indexes on every column appearing in a WHERE
  clause of a known query.
- **Postgres**: prefer `text` over `varchar(n)` unless length is a real constraint.
  Use `timestamptz`, never `timestamp`. Use `jsonb`, never `json`.
- **MySQL**: charset `utf8mb4` always, never `utf8`. Collation explicit.
- **SQLite**: `PRAGMA foreign_keys = ON`. WAL mode for anything concurrent.

## ORMs & migrations
- **Drizzle**: explicit `columns` selector on wide tables. Use `with:` for relations,
  never query-in-loop. Types inferred from schema via `InferSelectModel`/
  `InferInsertModel`, never hand-written. Migrations via `drizzle-kit generate`.
- **Alembic**: every migration has a non-empty `downgrade()` (hook blocks empty ones).
  If truly irreversible, document why AND raise `NotImplementedError`. Never hand-edit
  `op.execute()` with string-built SQL.
- **Migrations are reversible and tested against prod-like data before merge.**
