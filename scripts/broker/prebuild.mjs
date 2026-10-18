// prebuild.mjs — the landing check builds what the repo's pre-push gate will run (KIT-T561). A repo
// with `pre_push: true` and a `gate_prebuild:` command (e.g. `cd rust && cargo t --no-run`, the
// gate's own build shape and feature set) runs it once after a landing's tests, in the shared
// target dir, so the gate compiles nothing. Only a change that reaches a crate triggers it; a docs-only
// landing, or a path no crate owns (the gate then runs its full lane), adds nothing.
//
// `prebuildCommand(repo, cwd, files)` (files: the plan's Map path → { text }) → the command, or null.
// `withPrebuild(commands, command)` → `commands` plus `command`, once.

import { selectAffected } from './affected.mjs';

export function prebuildCommand(repo, cwd, files) {
  if (!repo || !repo.prePush || !repo.gatePrebuild) return null;
  const deleted = [...files].filter(([, f]) => f.text === null).map(([p]) => p);
  const sel = selectAffected(cwd, [...files.keys()], { deleted });
  if (sel.unmapped.length || !sel.reasons.some((r) => r.crate)) return null;
  return repo.gatePrebuild;
}

export const withPrebuild = (commands, command) => (command && !commands.includes(command) ? [...commands, command] : commands);
