# Delegation COST — scale the ceremony, isolate the checkout

The full text of the global contract's delegation rules (the contract keeps a short pointer). Read it before
dispatching writers.

Cost tracks the **tool-call count**, not the size of the change: every call re-sends
the accumulated transcript, so 100 calls is roughly quadratic.
- **Several agents share one working tree; the kit guards two collisions only (KIT-T1114).**
  **NO worktrees, clones, feature branches or second work directories, ever** (KIT-D039):
  every agent works in the maintainer's one checkout, on main, keeping it building by
  testing each step. Separate copies duplicate effort and strand work. Never borrow
  another project's checkout as a scratch copy.
- **A gate-forced restructure gets PRESENTED FIRST.** When a lint/length gate turns a
  small edit into a module split, show the maintainer before doing it.
- **Don't turn a subjective judgement into thresholds to hit.** Where the
  maintainer's ear/eye is the acceptance test: make the change, PRINT the
  measurements, ship for judgement. Assertions loose enough to catch regressions,
  never tight enough to require tuning — the tuning search is where the tokens go.
- **A named reference + a named event is a SIGNATURE and a LOCATION — go straight
  there.** A targeted edit, not an investigation.
- **If a subjective ask is genuinely NOT obvious, ASK — do not spend.** One
  clarifying question costs a turn; guessing at scale costs six figures of tokens.
  Never open-ended search on an unclear subjective brief.
- **Scale verification to BLAST RADIUS**, stated in the brief: shared/load-bearing →
  golden record + mutation-check the key invariant; contained feature → assert the
  new behaviour, one negative control; leaf/mechanical → measure, assert, done.
- **Any number of writers share a checkout; only a same-file write and a write into a
  running build are refused — gate-enforced (KIT-T1114, supersedes KIT-D077 and KIT-D144's
  one-writer limit).** The maintainer: "The aim was NEVER to stop multiple fucking writers."
  "The aim was to stop MULTIPLE WRITERS ON THE SAME FUCKING FILE OR WHILE A BUILD WAS RUNNING."
  A writer dispatched while another is in flight in the checkout declares
  `[paths: <files or folders>]` (alone it needs none) and is refused only when they overlap
  an in-flight writer's. The write guard refuses an Edit/Write to a file another live agent
  changed and has not committed, and to a build input of a crate another writer's running
  cargo build compiles (the refusal names the one wait, `builds --wait "<file>"`: foreground,
  returns when no build compiles the file or after 170 s); an agent's own files and builds always pass.
  The next ticket of the signed bill still goes to the SAME agent after it lands (warm build,
  warm context). Read-only = no Edit/Write in the definition's `tools:` (`claude-kit:analyst`,
  `researcher`, Explore, Plan), or `[read-only: <reason>]` on a writer-capable type. A writer in
  a different git checkout declares `[tree: <its root>]`; that root must be the session's
  project or the brief cites a ticket of it, else the maintainer's words:
  `[maintainer-asked-tree: <his words>]`. Overlapping paths on purpose need the maintainer's
  quoted words: `[maintainer-asked-parallel: <his words>]`.
- **No context size limit; waste is the limit (KIT-D149, KIT-D158, supersedes KIT-D116).** An agent is
  never retired, blocked or replaced for the size of its context: real work is fine at any size.
  The session coordinator tracks the waste share per agent (bash dumps, repeated lines, raw-log
  reads, polled waits; the avoidable lines are named in the flag) and retires or redirects an agent
  whose context is mostly avoidable, naming the avoidable lines. Every brief tells the agent to
  redirect long output to a file and read only what they need. An agent retired for waste MUST
  write a `Handoff <agent id>` block (Jobs:, State:, Next:, Files:) in the ticket Notes, never a
  scratchpad: request it (`[write-handoff]`); the dispatch guard refuses a replacement until it
  exists.
- **No agent waits (KIT-D115, KIT-D104's 5 minutes).** One foreground broker wait under 5 minutes
  is fine; polling, loops, background waits and re-running a job to read it are denied. Past the
  wait the agent writes its handoff and ends; inside the signed bill, resume it from
  `target/broker/finished.log` (one Monitor), not by keeping it alive. Outside the bill the
  handoff is an OPEN notice for the maintainer (KIT-D132).
- **Commit message files are unique per run (KIT-T1135).** The agents of one session share one
  scratchpad directory. A message file for `git commit -F` is written with the Write tool to
  `<scratchpad>/commit-<ticket id>-<six random characters>.txt`, never to a fixed name such as
  `msg.txt`; every dispatch brief that has an agent commit says so. The commit gate refuses a `-F`
  file another agent of the session last wrote.
