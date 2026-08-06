---
id: KIT-T181
title: bootstrap.mjs registers kit bin/ on the user PATH — PowerShell tool + interactive shells can't see plugin bin injection
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T180]
files: []
supersedes:
superseded_by:
created: 2026-08-05T16:13:06Z
updated: 2026-08-05T16:13:06Z
---

## Description
KIT-T180 shipped `bin/` with paired shims (extensionless sh + `.cmd`) for q / t / cap / rem /
code-graph, and the plugin injects that dir into the Bash tool's PATH. Nothing puts it on the
MACHINE's PATH, so on 2026-08-05 (Windows) the shims were on neither the process nor the user PATH:
`code-graph` was unusable in-session until called by absolute path, and the PowerShell tool shell
gets no plugin-bin injection at all. Worked around by hand-appending `D:\dev\claude-kit\bin` to the
user PATH — a per-machine manual step, which is exactly what bootstrap exists to remove.

Provenance: inbox 2026-08-05-2302 (its cap `--help` half shipped as KIT-T184); noted as the
follow-up in KIT-T180's History.

This is a FEATURE, not a small fix, because provisioning a persistent PATH is
platform-specific and one of the platforms can lose data:

* **Windows.** `setx PATH "%PATH%;…"` is the obvious move and is DANGEROUS: setx truncates at
  1024 characters, and reading `%PATH%` gives the MERGED machine+user value, so the classic
  one-liner can write the merged path into the user variable and silently truncate it. The safe
  read/write is the USER value only — `[Environment]::GetEnvironmentVariable('PATH','User')` /
  `SetEnvironmentVariable(..., 'User')` (no length limit, no merge), or the equivalent registry
  write under HKCU\Environment with a WM_SETTINGCHANGE broadcast. bootstrap is Node, so it would
  shell out to PowerShell for this — the first place the installer would need a per-platform
  branch of that shape.
* **POSIX.** There is no user PATH — it is a line appended to a shell rc, and WHICH rc depends on
  the shell (~/.zshrc, ~/.bashrc, ~/.bash_profile, ~/.profile) and whether the session is a login
  shell. Appending to the wrong one does nothing; appending to several duplicates the entry.
* **Idempotence.** Re-running bootstrap must not append a second copy, and must recognise the
  entry when the path differs only by separator/case (Windows) or a trailing slash.
* **Current-shell caveat.** Neither platform can change the PATH of an ALREADY-RUNNING shell.
  The installer has to say so in its receipt ("new shells only"), or the maintainer reads the
  success line and concludes the tools are live when they are not — the very confusion this
  ticket comes from.

Also worth deciding: whether an interactive-shell PATH is even the right layer, or whether the
PowerShell-tool gap (no plugin-bin injection) should be closed the same way the Bash tool's was.
Both surfaces are named here so the fix is chosen once rather than twice.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] `node bootstrap.mjs` appends the kit's `bin/` to the USER PATH on Windows, reading and
      writing the User-scoped value only (never the merged machine+user value, never `setx`)
- [ ] on POSIX it appends one export line to the detected shell rc, naming the file it touched
- [ ] re-running bootstrap is a no-op — no duplicate entry, path comparison tolerant of
      separator/case/trailing-slash differences
- [ ] the receipt states the change takes effect in NEW shells only, and prints the one-liner to
      apply it to the current shell
- [ ] `DRY_RUN=1` reports the intended PATH change and writes nothing
- [ ] a test covers the idempotence check and the DRY_RUN path without mutating the machine's
      real environment (the PATH read/write is injectable)
- [ ] KIT-T180's PowerShell-tool gap is either closed or explicitly deferred with a reason

## Plan
1. Decide the layer (user PATH vs a PowerShell-tool injection mirroring the Bash tool's) —
      see the Description; both surfaces are on the table.
2. Extract PATH read/write behind a tiny injectable module so the test never touches the real
   environment.
3. Windows: PowerShell `[Environment]::(Get|Set)EnvironmentVariable(..., 'User')`.
   POSIX: detect the rc file from $SHELL, append one guarded line.
4. Idempotence + DRY_RUN + receipt wording, then tests.

## History
- [2026-08-05 16:13] (created) feature — bootstrap.mjs registers kit bin/ on the user PATH — PowerShell tool + interactive shells can't see plugin bin injection
