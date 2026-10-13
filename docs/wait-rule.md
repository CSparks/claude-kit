## Waiting on builds and tests (KIT-T355)
Cost is per tool call, so a wait is ONE call and one read of the result.
- Run a long build or test in one Bash call with the max timeout, or with `run_in_background` and wait for the completion notification.
- Pipe the output through a filter that keeps only failures, panics, assertion lines and the `test result` totals.
- Never poll an output file, never sleep-loop, and never re-run a whole suite to see one test: run that test by name.
