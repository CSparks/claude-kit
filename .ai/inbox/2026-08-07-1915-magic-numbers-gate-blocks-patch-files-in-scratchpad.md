# Magic-numbers pre-write gate blocks .patch files in the scratchpad

Captured: 2026-08-07 19:15Z · stiletto-2349 session · type: bug (kit hooks)

Writing a git patch file (single-hunk staging workflow) to the session
scratchpad tripped the `magic-numbers` pre-write gate: a patch BODY quotes the
numeric lines it changes, so any patch touching a tuning value is unwriteable.
Same class as generated/data artifacts: the file is not authored source.

Workaround used (no exclusion added, per contract): skipped the file entirely —
`git diff -- <file> | awk '/^@@/{h++} h<2' | git apply --cached -`.

Decide: should the pre-write gates exclude the session scratchpad directory
(and/or `*.patch`/`*.diff`) globally, or stay strict and bless the pipe-to-apply
idiom as the documented path for partial staging?
