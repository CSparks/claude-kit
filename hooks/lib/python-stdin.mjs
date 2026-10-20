// A `python3 -` / `python3 <<EOF` / `... | python3` command on Windows where `python3` cannot read a
// script from stdin (the Microsoft Store stub, or a shim that waits forever): the shell never exits. The
// hook refuses the command and points at node (`node -e`, or a script file run with `node file.mjs`).
//
//   pythonStdinCommand(command, { isStub }) -> null | { name }   (isStub(name) -> true when stdin hangs)
//   isBrokenStdinPython(name)  true when `name` resolves into WindowsApps, or does not print the
//                              answer to a one-line script on stdin within PROBE_MS

import { spawnSync } from 'node:child_process';
import { segments } from './shell-segments.mjs';

const PYTHON = /^(?:python3?|py)(?:\.exe)?$/i;
const STORE_DIR = /[\\/]WindowsApps[\\/]/i;
const HEREDOC = /<<-?|<<</;
const PROBE_MS = 3000;
const PROBE_ANSWER = '7';

export function isBrokenStdinPython(name) {
  if (process.platform !== 'win32') return false;
  const where = spawnSync('where', [name], { encoding: 'utf8', windowsHide: true });
  const first = String(where.stdout || '').split(/\r?\n/).find(Boolean) || '';
  if (!first) return false;
  if (STORE_DIR.test(first)) return true;
  const probe = spawnSync(name, ['-'], { input: `print(${PROBE_ANSWER})\n`, encoding: 'utf8', timeout: PROBE_MS, windowsHide: true });
  return !!probe.error || String(probe.stdout || '').trim() !== PROBE_ANSWER;
}

function readsStdin(text, after) {
  const tok = text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
  const args = tok.slice(1);
  if (args.includes('-')) return true;
  if (HEREDOC.test(text)) return true;
  const runsCodeOrFile = args.some((a) => /^-[cm]$/.test(a) || /\.py["']?$/i.test(a));
  return after === '|' && !runsCodeOrFile;
}

export function pythonStdinCommand(command, { isStub = isBrokenStdinPython } = {}) {
  for (const { text, after } of segments(String(command || ''))) {
    const leader = (text.trim().split(/\s+/)[0] || '').replace(/.*[\\/]/, '');
    if (PYTHON.test(leader) && readsStdin(text, after) && isStub(leader.replace(/\.exe$/i, ''))) return { name: leader };
  }
  return null;
}
