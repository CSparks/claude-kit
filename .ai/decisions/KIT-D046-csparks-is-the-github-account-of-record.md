---
id: KIT-D046
title: CSparks is the GitHub account of record; depixeled-chris is legacy
date: 2026-08-02
supersedes:
source: conversation 2026-08-02 (D:\dev "why isn't gridiron-blitz here" session)
---

**Decision:** `github.com/CSparks` is the account of record. Every future
remote — new repo, re-pointed origin, backup target, published plugin or
marketplace URL — goes to CSparks unless the maintainer names another
destination for that specific repo. `github.com/depixeled-chris` is legacy:
still authenticated in `gh` and still holding a near-complete parallel set of
the same repo names, but no longer authoritative for anything.

**Why:** 2026-08-02 — a local survey found all ~50 `D:\dev` working trees
already pointing at `CSparks/*`, and the CSparks token lists 63 repos there
(vs 55 stale ones under depixeled-chris). But `D:\github-backup-2026-07-26`
was mirrored from **depixeled-chris**, so the disaster-recovery copy is of the
legacy account, not the live one — for gridiron-blitz the mirror stops at
`60d6d1f` (2026-07-25) while CSparks has `a69167e` (pushed 2026-07-28). A
backup of the wrong account reads as protection while protecting nothing.

**Consequences:**
- Re-run any repo backup against CSparks; treat the 2026-07-26 mirror as a
  legacy-account snapshot, not the current safety net.
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and
  `README.md` in claude-kit advertise `depixeled-chris/claude-kit` — an
  outward-facing pointer at the legacy account, still to be corrected.
- Two `gh` accounts stay authenticated with depixeled-chris ACTIVE, so a bare
  `gh repo list CSparks` under-reports (public + collaborator repos only).
  Query CSparks with its own token before concluding a repo is missing.

**Update 2026-08-05 — the legacy account is now LOCKED, and this is a standing
condition, not just a preference.** Chris has no recovery codes for
`depixeled-chris`, so "legacy" hardens into: it is not the account of record for
anything, and nothing new points at it. Verbatim: "Anything pushed to
depixeled-chris is going in the wrong fucking place until the recovery codes are
found or access is restored" / "It shouldn't be the account of record, at least
not until and if it's ever unlocked."
- *Clears when:* the account is recovered AND Chris says to use it again.
  Recovery alone does not flip it back.
- A stale copy of a repo still sitting on that account is harmless — the thing
  that matters is that no remote, doc, or plan-of-record entry references it.
- Re-verified 2026-08-05: every GitHub remote across all ~50 working trees under
  `D:\dev` points at `CSparks/*`; zero at depixeled-chris. The outward-facing
  pointers flagged above are now clean — `.claude-plugin/plugin.json`,
  `marketplace.json`, and `README.md` all advertise `CSparks/claude-kit`.
- `gh`'s ACTIVE account is now CSparks (was depixeled-chris when this was
  written), so the under-reporting caveat above is inverted: a bare
  `gh api repos/depixeled-chris/<name>` 404s on visibility, which is NOT proof
  the repo is absent there.
- Commit authorship remains `depixeled.chris@gmail.com`, which GitHub attributes
  to the locked account (verified on jollys-vinyl c6a18a8: `linked account:
  depixeled-chris`). Cosmetic only — push destination and access are the CSparks
  SSH key + token. Chris 2026-08-05: "not concerned with the cosmetic stuff right
  now. Might change that eventually." Fixing it forward is a one-line
  `user.email` change; past commits would need a history rewrite, which is not on
  the table.
- Recorded portably in the private overlay's **Standing conditions** section so
  every adopted repo inherits it. A general mechanism for that section — itemized
  standing conditions with clearance conditions, surfaced as callouts at session
  start — is captured as a feature request (inbox 2026-08-05-1545).
- Project-level stores carry only their own remote fact and point here; they must
  NOT restate this decision. jollys-vinyl JV-Q003's stale 2026-07-05 answer
  (which named depixeled-chris) is corrected to point at this entry. A duplicate
  of this decision was mistakenly written as jollys-vinyl JV-D006 on 2026-08-05
  and removed the same day; root cause captured (inbox 2026-08-05-1838).
