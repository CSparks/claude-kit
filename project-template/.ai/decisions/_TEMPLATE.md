---
id: KEY-D001
title: <short title>
summary:               # OPTIONAL one-line gist - shown by q trail / handoff briefs
date: <YYYY-MM-DD>
supersedes:        # the <KEY>-D### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** <what was decided>

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — D-009). IDs <KEY>-D### (e.g. KIT-D010),
     assigned in order, never reused. The FILENAME is `<id>-<slug>.md` (e.g.
     KIT-D010-central-workflow-data.md) — the id-integrity check requires the frontmatter
     `id:` and the filename's leading id token to agree, so rename both together.
     Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
