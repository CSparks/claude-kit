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

// Where a shell tool call starts: the payload's `cwd` (the shell's directory) when it names a directory, else the hook's own
// cwd, which is the session project root and not the directory a subagent's shell sits in (KIT-T1347).
export const payloadStartDir = (p) => (typeof p?.cwd === 'string' && p.cwd && isDirectory(p.cwd) ? p.cwd : process.cwd());

const FLOW_OPEN = /^(?:if|while|until|for|select|case|function)\b/;
const LEADING_FLOW = /^(?:(?:then|else|elif|do|if|while|until|time|!)\s+|[({]\s*)+/;

/**
 * Every directory a hit in segment `upto` may run in, after the `cd` segments before it: one when each cd surely ran in this
 * shell (joined from the start by `;` or `&&` after a cd that cannot fail, outside any pipeline, group or control structure),
 * else the directory with the cd followed and the one without it, so a gate judging each fails closed.
 */
export function cwdsBefore(command, start = process.cwd(), { upto = Infinity, shell = '' } = {}) {
  const parts = [...segments(String(command || ''), { shell })];
  let dirs = new Set([start]);
  const made = new Set();
  let flow = false;
  let cannotFail = true;
  parts.slice(0, Math.min(upto, parts.length)).forEach((part, k) => {
    const text = part.text.trim();
    const bare = text.replace(LEADING_FLOW, '').replace(/\s*[)}]+$/, '');
    if (FLOW_OPEN.test(bare)) flow = true;
    const joined = part.after === 'start' || part.after === ';' || (part.after === '&&' && cannotFail);
    // The operator after the segment must be one that runs the next command in this shell once it finished: `|`, `|&`, `&` and `||` do not.
    const next = parts[k + 1]?.after;
    const settled = next === undefined || next === ';' || next === '&&';
    const sure = joined && settled && !flow && bare === text;
    const target = cdTarget(bare);
    [...dirs].forEach((dir) => madeDirectories(bare, dir).forEach((dirMade) => made.add(dirMade)));
    const moved = target ? [...dirs].map((dir) => resolve(dir, target)).filter((next) => isDirectory(next) || made.has(next)) : [];
    cannotFail = sure && moved.length > 0;
    if (moved.length) dirs = sure ? new Set(moved) : new Set([...dirs, ...moved]);
  });
  return [...dirs];
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
