---
id: KIT-Q001
status: open           # open | resolved
answerable_by: chris   # chris | claude  (see config.yml classifications.question)
created: 2026-08-06
---

**Q:** When a capture's text obviously names a DIFFERENT registered project than the cwd one,
should `cap` REFUSE to write until the operator picks a target, instead of writing to cwd with a
warning?

Context (KIT-T186, 2026-08-06): a kit-named capture was written into the cwd project's inbox and
the mismatch warning was noticed only afterwards. KIT-T067 deliberately chose PROPOSE-don't-route
("that project is PROPOSED on stderr so a misroute is caught before triage — but the cwd fallback
still owns the write"), so flipping it to a refusal reverses a recorded design decision rather
than fixing a defect, which is why it is a question and not part of the fix.

What KIT-T186 already changed (non-controversial, shipped): the warning is emitted BEFORE the
write, and the receipt itself carries `[also names <project>]`, so the one line an agent relays
says the destination is disputed.

The trade-off:
* REFUSE — a misroute becomes impossible, but a false positive (a capture that legitimately
  mentions another project) costs a re-run, and cap's value is that a capture never blocks. A
  human mid-thought could lose the text; an agent just re-runs.
* WARN (today) — nothing is ever lost, but a wrong store is only caught if someone reads the
  receipt.
* A third option: refuse only when the text names another project AND does NOT name the cwd
  project — narrower, fewer false positives, more logic to explain.

Note an interactive prompt is not available: cap runs non-interactively (agents, hooks, pipes),
so the choice is refuse-or-warn, not "ask at the terminal".

**Resolution:** <answer + date, filled when resolved; set status: resolved>
