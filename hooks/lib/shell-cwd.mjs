// shell-cwd.mjs — the directory a Bash/PowerShell command line acts in (KIT-T700). The harness resets a
// subagent's shell to its primary directory, so agents `cd /d/dev/repo && …`; a gate that resolves the
// repo from the hook's own cwd then sees no repo and no-ops. Following the command's `cd` segments names
// the repo the command really touches.
//
//   commandCwd(command, start?) -> the directory after every existing `cd <dir>` segment; `start` when none

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cdTarget, segments } from './shell-segments.mjs';

export function commandCwd(command, start = process.cwd()) {
  let cwd = start;
  for (const { text } of segments(String(command || ''))) {
    const target = cdTarget(text.trim());
    if (!target) continue;
    const next = resolve(cwd, target);
    if (existsSync(next)) cwd = next;
  }
  return cwd;
}
