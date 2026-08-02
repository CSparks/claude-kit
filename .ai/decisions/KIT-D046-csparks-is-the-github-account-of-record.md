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
