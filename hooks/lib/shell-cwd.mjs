// shell-cwd.mjs — the directory a Bash/PowerShell command line acts in (KIT-T700). The harness resets a
// subagent's shell to its primary directory, so agents `cd /d/dev/repo && …`; a gate that resolves the
// repo from the hook's own cwd then sees no repo and no-ops. Following the command's `cd` segments names
// the repo the command really touches.
//
//   commandCwd(command, start?, { upto?, shell? }) -> the directory after every `cd <dir>` segment naming an existing
//     directory; `start` when none. With `upto` (a segment index of segments(command, { shell })) only the segments
//     before it count: the directory a hit in that segment runs in, not where the whole command ends.

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { cdTarget, segments } from './shell-segments.mjs';

export const isDirectory = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };

export function commandCwd(command, start = process.cwd(), { upto = Infinity, shell = '' } = {}) {
  let cwd = start;
  let index = 0;
  for (const { text } of segments(String(command || ''), { shell })) {
    if (index++ >= upto) break;
    const target = cdTarget(text.trim());
    if (!target) continue;
    const next = resolve(cwd, target);
    if (isDirectory(next)) cwd = next;
  }
  return cwd;
}
