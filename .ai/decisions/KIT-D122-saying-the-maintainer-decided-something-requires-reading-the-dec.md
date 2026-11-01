---
id: KIT-D122
title: Saying the maintainer decided something requires reading the decision with q show first
summary: Before any session tells the maintainer "you decided X", it reads the decision record itself with q show <id>. A search excerpt is never enough. Without that read, the claim is stated as "not checked". The rule goes into the global CLAUDE.md contract (base source in claude-kit).
date: 2026-10-30
supersedes: 
source: Chris 2026-10-30, marblequest session, AskUserQuestion answer on KIT-T721
---


**Decision:** Before saying a decision was the maintainer's ("you decided X", "settled: X"), a session reads that decision with `q show <id>`. A `q fts` hit or any other search excerpt does not count. If the session has not read it, it says "not checked". The rule goes into the global CLAUDE.md contract, in its base source in claude-kit, next to the anti-relitigation and state-claim receipt rules.

**Maintainer:** Chris, 2026-10-30. Asked "should CLAUDE.md gain a rule that saying 'you decided X' requires reading the decision first (q show <id>), not quoting a search excerpt?", he chose "(Recommended) Add the rule".

**Why:** KIT-T721. A session told the maintainer "you decided no sim gears" based on a `q fts` excerpt that matched the decision's Rejected line. The q-side fix (299e015) now shows the Decision paragraph. This rule covers the behaviour itself.

**Rejected:** relying on the q fts fix alone. It removes this one way to misread a decision, not the habit of attributing decisions from excerpts.
