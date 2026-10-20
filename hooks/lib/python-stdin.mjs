// A `python3 -` / `python3 <<EOF` / `... | python3` command on Windows where `python3` is the Microsoft
// Store stub: the stub waits on stdin forever and leaves a background shell that never exits. The hook
// refuses the command and points at node (`node -e`, or a script file run with `node file.mjs`).
//
//   pythonStdinCommand(command, { isStub }) -> null | { name }   (isStub(name) -> true for a stub)
//   isStoreStub(name)  true when `where <name>` resolves first into a WindowsApps directory

import { spawnSync } from 'node:child_process';
import { segments } from './shell-segments.mjs';

const PYTHON = /^(?:python3?|py)(?:\.exe)?$/i;
const STORE_DIR = /[\\/]WindowsApps[\\/]/i;
const HEREDOC = /<<-?|<<</;

export function isStoreStub(name) {
  if (process.platform !== 'win32') return false;
  const r = spawnSync('where', [name], { encoding: 'utf8', windowsHide: true });
  const first = String(r.stdout || '').split(/\r?\n/).find(Boolean) || '';
  return STORE_DIR.test(first);
}

function readsStdin(text, after) {
  const tok = text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
  const args = tok.slice(1);
  if (args.includes('-')) return true;
  if (HEREDOC.test(text)) return true;
  const runsCodeOrFile = args.some((a) => /^-[cm]$/.test(a) || /\.py["']?$/i.test(a));
  return after === '|' && !runsCodeOrFile;
}

export function pythonStdinCommand(command, { isStub = isStoreStub } = {}) {
  for (const { text, after } of segments(String(command || ''))) {
    const leader = (text.trim().split(/\s+/)[0] || '').replace(/.*[\\/]/, '');
    if (PYTHON.test(leader) && readsStdin(text, after) && isStub(leader.replace(/\.exe$/i, ''))) return { name: leader };
  }
  return null;
}
