# SESSION HANDOFF — claude-kit

Updated: 2026-08-02 | Branch: main @ origin (7c5ca72) | Active: KIT-T142 in review

## Current state
- **KIT-T142 REVIEW (8249cd5, pushed) — the suite no longer clobbers the live cache.**
  Bisected all 36 suites counting scope rows directly in SQLite (q.mjs's staleness
  auto-rehydrate masks the damage otherwise). FOUR offenders, not one:
  `test-hooks.mjs` (211→3), `comments.test.mjs` (211→1), `begin-task.test.mjs`
  (211→1), `t.test.mjs`. Each spawns a CLI/hook whose refresh calls
  `hydrate({ dbPath: defaultDbPath() })`; the fixture config declares `ids.key: "KIT"`,
  so hydrating a temp fixture REPLACED the live KIT scope.
  - Fix: redirect `CLAUDE_PLUGIN_ROOT` to a throwaway dir process-wide in each suite
    (children inherit), plus an explicit `CHILD_ENV` on t.test.mjs's execFileSync.
  - Fixture keys deliberately NOT renamed: fixture ids and real ticket citations
    overlap in these files (KIT-T050/T051 are both), so a bulk rename corrupts
    provenance. Isolation makes the collision unreachable.
  - Evidence: `npm test` exit 0, zero failures, KIT rows 211 → 211; bisect reports
    "none — the suite leaves the KIT scope intact".
- **Inbox drained to 0 (7c5ca72).** 11 caps → KIT-T158..T164 + KIT-D047, with 3 folds
  (dup triage-title cap → KIT-T126; both CRLF caps → KIT-T124). Declined every inferred
  provenance: all candidates claimed `regressed_from=KIT-T025` ("dedup strategy"), a
  weak guess that would have become auditable-but-wrong history.

## Landmines found today (logged, not fixed)
- **KIT-T164 — hydrate-at-source clobbers a scope from ANY `.ai/` store on disk.** This
  is the REAL root cause; KIT-T142 was only its test-shaped symptom. `writeItemFile`
  (hooks/lib.mjs:308) resolves the store via `storeRoot()` (lib.mjs:358), which returns
  any ancestor holding `.ai/config.yml` — including a scratchpad fixture — then hydrates
  it into the live DB. MEASURED: a single Edit to a scratchpad fixture declaring
  `ids.key: "KIT"` took the live scope 56 → 1. No test suite involved. Repair is
  `node scripts/hydrate-db.mjs`.
- **CRLF/BOM frontmatter break is LIVE, not fixed** — hit it twice today writing fixtures
  with PowerShell `Set-Content -Encoding utf8` (PS 5.1 emits a BOM): `t status` failed
  with "no frontmatter block to update". KIT-T124 carries both folded caps. Use
  `New-Object System.Text.UTF8Encoding($false)` when writing store files from PowerShell.
- **Duplicate ids blocked the commit gate.** A 15:42 triage batch on 2026-07-23 minted
  KIT-T136–139 already claimed that morning by web-UI tickets. The UI ones are cited in
  six commits, the triage ones only in the generated board → triage batch re-keyed to
  **KIT-T154–157** with `aka:` backlinks. Live instance of KIT-T117 / KIT-T162.
- A stale `node server/index.mjs` from 2026-07-24 may still hold :4319 and serve
  pre-T153 code. Use `KIT_SERVER_PORT=4400` for any live check.

## Gate false-positives — 2 of 4 landed
- **KIT-T121 REVIEW (083c1ab)** — file-length judged the Edit FRAGMENT, so corridor.rs
  reached 2939 lines against a 600 hard limit without one warn. It now reconstructs the
  post-edit text from disk (index-based surgery, never `String.replace`, so a `$&` in the
  replacement stays literal). Scoped to file-length only — the other checks are line-keyed
  at the diff, and whole-file rescans would block unrelated edits on old violations.
- **KIT-T114 REVIEW (f99ed19)** — the reported YAML case was ALREADY covered (line 184
  exits early for DATA). Real gaps were classes an extension test can't express: nginx
  `.conf`, `Dockerfile` (no extension at all), shell-family scripts with no native linter.
  Added conf/properties/env to DATA, an INFRA_BASENAME regex, and a SHELL_LIKE set
  (ps1/psm1/bat/cmd) exempt from magic-numbers ONLY — rot-marker/dead-code still apply.

## Next 3 steps
1. **KIT-T155 + KIT-T111 — the remaining two gate bugs.** T155 (magic-numbers blocks Edit
   diffs inside `claude-kit-ignore-start/end` blocks) shares a root with the T121 fix just
   landed: on an Edit, `markerExcludedLines(content)` sees only the FRAGMENT, so a marker
   block living in the file is invisible. Likely fix is reading enclosing markers from
   disk and mapping fragment lines onto file lines. T111 is the file-level marker not
   honored when it carries trailing em-dash text.
2. KIT-T164 — scope hydrate-at-source to registered project roots, or key rows by
   resolved root path instead of a self-declared `ids.key`.
3. KIT-T162 / KIT-T117 — next-id must not mint an already-claimed id.

## Carry-over
- Chris explicitly deferred the review queue this session ("leave the queue alone");
  15 KIT tickets sit in review awaiting his `/done`.
- **CSparks is the GitHub account of record** (KIT-D046, 28b2685). depixeled-chris is
  2FA-locked and gets no updates; CSparks must never be behind. Audited 2026-08-02:
  zero commits stranded. Plugin/marketplace/README repointed at CSparks (d5dcf5c).
- Commit `d5dcf5c` is over-scoped: `git add -A` swept pre-existing package.json/lock
  changes and 2 inbox captures under a URL-change message. Live instance of KIT-T106.
