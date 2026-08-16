# Dispatch receipts still missing [model] brackets AFTER same-session capture — escalate to hook

2026-08-12, marblequest (same session as
2026-08-12-stale-installed-agent-copies-lose-model-pin.md). After capturing that
issue — whose fix (c) was "dispatch receipts state model+effort explicitly" — the
main thread kept launching agents without a bracketed model tag in the receipt.
Maintainer had to point it out a second time: a repeat process failure on an
already-captured rule.

ROOT CAUSE: the convention was adopted as in-context intention only. Nothing durable
enforced it — not CLAUDE.md, not a memory, not a hook — so it decayed within one
session. Session-local promises are not process fixes.

THIRD occurrence same session (after this capture + a memory): dispatches went out
without the model prefix in the Agent LABEL (the `description` param the UI renders
under the task). The maintainer's requirement is the label form: `"[opus] <task>"`.
Two captures + a memory failed to change in-session behavior — that is the strongest
possible evidence that (a) below is the ONLY real fix: the hook must inject or reject,
not advise. A PreToolUse hook on Agent calls should REJECT any dispatch whose
`description` does not start with a `[<model>]` prefix matching the resolved model.

Fixes, in order of strength:
(a) HOOK (the real fix): dispatch-ladder PreToolUse on Agent/Task calls already fires;
    extend it to require an explicit `model` param on every delegation from a fable
    main thread (it exists — verify it actually blocks; it did NOT block the pinless
    kit-agent dispatches this session) AND emit the resolved model+effort into the
    transcript so the receipt is generated, not remembered.
(b) CLAUDE.md base: add one line to SUBAGENT DISPATCH: "Every dispatch announcement
    carries `[model: <tier>, effort: <level>]`."
(c) Until (a)/(b) land: user-level memory (written this turn, marblequest project).
