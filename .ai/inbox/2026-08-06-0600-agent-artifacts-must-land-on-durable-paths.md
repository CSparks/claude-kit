(bug) Agent research artifacts can land on non-durable paths and SESSION cites them unchecked

Tonight (stiletto): a researcher agent's deliverable was recorded in SESSION.md as
`scratchpad/recipe-model-harvest.md`, but the file exists in no repo — the agent wrote
to a cwd-relative/session-temp path that died with its session. The citation went into
the durable record without an existence check, so the loss surfaced only when the next
consumer (T128b) went looking.

Root cause: no rule/gate forces a delegated agent's file deliverable onto a durable,
repo-anchored absolute path, and no check verifies a SESSION-cited artifact path
exists at flush time. Candidate fixes: (a) briefs must name an absolute durable
destination for any file deliverable; (b) the flush/anchor hook warns on SESSION-cited
paths that don't resolve.
