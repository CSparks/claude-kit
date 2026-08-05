---
id: KIT-D054
title: context7 plugin stays a user-scoped install — the kit never ships or manages it
date: 2026-08-05
supersedes:
source: conversation 2026-08-05 ("context7 should be user scoped.")
---

**Decision:** The context7 plugin (`context7@claude-plugins-official`) remains a
user-scoped install per machine. The kit's role is everything AROUND it — the
knowledgebase, the lookup-order rule in the global contract, and any usage-ledger
hook — never shipping, wrapping, or managing the plugin install itself.

**Why:** Plugin installs are machine/user layer (like `user-config/`), not shared
tooling; a kit-shipped copy would create a second source of truth for something the
official marketplace already owns, and would couple the MIT kit to a third-party
paid service. Rejected: bundling context7 into the kit marketplace or gating its
presence via kit setup.
