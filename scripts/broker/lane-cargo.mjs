// lane-cargo.mjs — refuse a submodule-lane cargo command that would run in the parent workspace (KIT-T543).
// A lane runs its commands at the submodule root. When that root holds no Cargo.toml (rapid-game keeps
// its workspace in `rust/`), cargo walks up and finds the superproject's workspace instead.
//
// `parentWorkspaceCommand(repo, cwd, cmd)` → a message naming the fix, or null when the command is fine.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ENTERS_WORKSPACE = /(^|\s)cd\s|--manifest-path/;

export function parentWorkspaceCommand(repo, cwd, cmd) {
  const text = String(cmd).trim();
  if (!repo.submodule || existsSync(join(cwd, 'Cargo.toml'))) return null;
  if (!/(^|&&\s*|;\s*)cargo\s/.test(text) || ENTERS_WORKSPACE.test(text)) return null;
  return `--test "${text}" would run in the parent workspace: ${repo.name} has no Cargo.toml at its root, so cargo walks up to the superproject. Enter the workspace: --test "cd <workspace dir> && ${text}" (e.g. cd rust) or pass --manifest-path.`;
}
