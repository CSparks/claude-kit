---
id: KIT-D058
title: Binaries and LFS files are committed ONLY when the maintainer directly asks
date: 2026-08-06
supersedes:
source: conversation 2026-08-04 (Chris, verbatim); inbox 2026-08-05-0009 triaged 2026-08-06
---

**Decision:** No agent stages or commits binary / Git-LFS files on its own initiative. They go in
only when the maintainer directly asks for that commit. Chris, verbatim 2026-08-04: "If we need to
set a policy to NOT auto-commit LFS files and only do it when directly prompted by the user, we can
do that and it should be in Claude Kit's init prompt." Kit-level and portable — every adopted
project inherits it; no project restates it (KIT-D046 pattern). Wiring it into the init prompt and
the project template is KIT-T199; the per-repo LFS opt-in is KIT-T200.

**Why:** Binaries are unlike code. A wrong binary commit is permanent history, it consumes LFS
quota, and it slows every clone — none of which can be undone without a history rewrite. Text can
be reverted with a follow-up commit; a 40 MB texture cannot. So the asymmetry of cost sets the
default: hands off unless asked. Context: stiletto-2349 adopting Git LFS for 100-300 texture images
with a handful of revisions each.

Rejected: "commit binaries when they look intentional" — intent is exactly what an agent cannot
judge from a working tree, and the failure mode is unrecoverable. Also rejected: leaving this as a
machine memory file (it already existed as one), because a memory on one machine is not a policy —
the next machine and the next fresh session do not inherit it.
