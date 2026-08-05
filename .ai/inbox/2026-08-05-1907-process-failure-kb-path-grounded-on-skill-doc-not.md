# process failure: KB path grounded on the skill doc, not the decisions store

Session 2026-08-05 (context7/KB work): asserted `docs/research/` as the canonical
knowledgebase — in inbox 2026-08-05-1854 and in the KIT-D055 contract rule landed in
user-config/CLAUDE.global.md — citing the claude-kit skill doc ("docs/research/ →
the cross-project knowledgebase"). The decisions store says otherwise: **KIT-D004**
(2026-06-02) designated top-level `research/` (indexed, generic findings) as the KB;
its README + empty index sit there now. The four docs in `docs/research/` are kit
design docs (KIT-T020/T030/T023/T025 ids), and two of them explicitly park the
research/-vs-docs/research/ fork as an open maintainer question. Contradiction
noticed only after landing the rule.

ROOT CAUSE: grounded on a derived summary (the skill doc) instead of the primary
record (`.ai/decisions/`) before proposing/landing. The skill doc itself drifted
from KIT-D004 at some point — a second, unnoticed instance of the same failure.

Fixes queued this session: the fork goes to Chris as a questionnaire; whichever way
it lands, the contract rule path, the skill doc line, and inbox 1854 get reconciled
to the decision. Hook-enforcement angle for later: a lint that flags a landed
contract/skill edit citing a store path that no decision backs.
