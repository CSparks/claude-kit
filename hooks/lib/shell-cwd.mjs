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
import { cdTarget, segments, shellArgs, toPath } from './shell-segments.mjs';

export const isDirectory = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };

const MKDIR = /^(?:mkdir|md)$/i;

// The directories a `mkdir [-p] dir...` segment makes, resolved against `cwd`; a later `cd` into one follows it before it exists.
function madeDirectories(text, cwd) {
  const [tool = '', ...args] = shellArgs(text);
  return MKDIR.test(tool) ? args.filter((a) => !a.startsWith('-')).map((a) => resolve(cwd, toPath(a))) : [];
}

export function commandCwd(command, start = process.cwd(), { upto = Infinity, shell = '' } = {}) {
  let cwd = start;
  let index = 0;
  const made = new Set();
  for (const { text } of segments(String(command || ''), { shell })) {
    if (index++ >= upto) break;
    madeDirectories(text.trim(), cwd).forEach((dir) => made.add(dir));
    const target = cdTarget(text.trim());
    if (!target) continue;
    const next = resolve(cwd, target);
    if (isDirectory(next) || made.has(next)) cwd = next;
  }
  return cwd;
}
