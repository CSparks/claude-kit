# cap bug: milestone with subjective-value output drained end-to-end with zero human-UAT gates

Lived failure (groovegrid video-pipeline, 2026-07-23/24): five tickets (GG-T113..T116,
T137) were drained and landed on green suites and mechanical receipts (determinism,
sample-alignment, quantization law) before the maintainer watched ONE second of
output. First human viewing produced the verdict "ill-conceived bunch of bullshit" —
the entire milestone's value criterion (is the video watchable?) was subjective and
NO ticket carried a human-only acceptance criterion. Watchable output existed at
T113 stage 2; the drain blew past it because nothing structural said stop.

ROOT CAUSE: acceptance criteria were all machine-checkable, so the drain's
auto-execute logic saw only green. The base contract even warns "only the maintainer
judges visuals" — but nothing enforces a human gate when a milestone's value IS the
visual/subjective output.

WANT: structural, not memory-dependent —
- ticket/milestone frontmatter flag (e.g. `uat_gate: human`) that the drain treats
  like statuses.human_only: after the FIRST ticket producing user-facing output
  lands, the drain HALTS the milestone until the maintainer records a UAT verdict;
- triage/init nudge: when capturing a milestone whose deliverable is
  visual/audio/content, require at least one human-only acceptance criterion per
  ticket.
