(bug) ~/.claude/claude-kit-projects.json holds stale entries that weaken the new
KIT-T164 registered-store guard: `kit-budget-J2FaVP` → C:/Users/.../AppData/Local/Temp/
kit-budget-J2FaVP (a TEMP dir — a fixture landing there with ids.key KIT could still
clobber the live scope, exactly the hole T164 closed) and three groovegrid
.claude/worktrees/agent-* entries (dead worktrees). Also `asset-forge` exists in
claude-kit-data/projects but is NOT registered on this machine. Fix direction: registry
hygiene pass — prune entries whose path no longer exists or lives under a temp/worktree
dir (never auto-register those), register real data-repo projects, and consider an
orient warning when registry and data-repo project sets diverge. Found 2026-08-04 after
the phantom-scope cache rebuild. --priority high
