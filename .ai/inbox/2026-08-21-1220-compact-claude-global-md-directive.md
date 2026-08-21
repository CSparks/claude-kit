(request, done in same commit) Maintainer directive 2026-08-21: trim and compact the
composed ~/.claude/CLAUDE.md — bare kit init should budget 5-10K tokens. Trimmed
user-config/CLAUDE.global.md: stripped quoted maintainer remarks, dates/attributions,
and duplicated rationale; every rule and ticket id preserved. Measured with the local
llama tokenizer: composed CLAUDE.md 5875 -> 4610 tokens; total kit-attributable init
(CLAUDE.md + skill/agent/command descriptions) 7675 -> 6410. Deeper cuts possible only
by paraphrasing rules harder (nuance risk) — not taken without a further directive.
