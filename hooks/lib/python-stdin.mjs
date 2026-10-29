// A python command that reads its script from stdin where stdin is empty or absent, on Windows: bash hands it
// /dev/null (NUL, a character device), CPython 3.14 starts its pyrepl, and `getheightwidth()` raises on every
// loop: a full core forever. With no stdin source at all it blocks for good on the Bash tool's stdin pipe
// (KIT-T699, KIT-T584, KIT-T670). The hook refuses the command and points at node.
//
//   pythonStdinCommand(command, { isStub?, platform? }) -> null | { name, reason }
//     reason: 'empty-heredoc' (heredoc with no body) | 'no-stdin' (`python -` / bare python with no `<`,
//     heredoc or pipe) | 'store-stub' (python resolves into WindowsApps)
//   isStorePython(name)  true when `name` resolves into the Microsoft Store WindowsApps stub
//
// Allowed: a non-empty heredoc, a here-string, `< file`, a pipe, and scripts, `-c`, `-m`.

import { spawnSync } from 'node:child_process';
import { heredocAfter } from './heredoc.mjs';
import { segments } from './shell-segments.mjs';

const PYTHON = /^(?:python|pythonw|py)(?:\d+(?:\.\d+)*)?(?:\.exe)?$/i;
const STORE_DIR = /[\\/]WindowsApps[\\/]/i;
const WRAPPERS = new Set(['env', 'exec', 'command', 'nohup', 'time', 'sudo']);
const DURATION = /^\d+(?:\.\d+)?[smhd]?$/;
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const REDIRECT = /^(?:\d*[<>]|&>)/;
const INPUT_REDIRECT = /(?:^|\s)\d*<(?![<(])\s*\S/;
const VALUE_FLAGS = new Set(['-W', '-X', '-Q']);
const EXITING_FLAGS = new Set(['--version', '-V', '-VV', '--help', '-h']);
const CODE_FLAGS = new Set(['-c', '-m']);

const tokens = (text) => text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
const unquoteAll = (text) => text.replace(/"[^"]*"|'[^']*'/g, ' ');

export function isStorePython(name) {
  if (process.platform !== 'win32') return false;
  const where = spawnSync('where', [name], { encoding: 'utf8', windowsHide: true });
  const first = String(where.stdout || '').split(/\r?\n/).find(Boolean) || '';
  return STORE_DIR.test(first);
}

/** The python leader of one simple command, past env/timeout/exec/command prefixes; null when it is not python. */
function pythonLeader(tok) {
  let i = 0;
  while (i < tok.length) {
    const word = tok[i].replace(/.*[\\/]/, '');
    if (WRAPPERS.has(word) || ASSIGNMENT.test(tok[i])) i++;
    else if (word === 'timeout') { i++; while (i < tok.length && (tok[i].startsWith('-') || DURATION.test(tok[i]))) i++; }
    else break;
  }
  const name = (tok[i] || '').replace(/^["']|["']$/g, '').replace(/.*[\\/]/, '');
  return PYTHON.test(name) ? { name, args: tok.slice(i + 1).filter((a) => !REDIRECT.test(a)) } : null;
}

/** True when the interpreter would read the program from stdin: `-`, or no script/code argument at all. */
function readsStdin(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-') return true;
    if (CODE_FLAGS.has(a) || (a.startsWith('-c') && a.length > 2) || EXITING_FLAGS.has(a)) return false;
    if (VALUE_FLAGS.has(a)) { i++; continue; }
    if (!a.startsWith('-')) return false;
  }
  return true;
}

function stdinSource(segment, heredoc) {
  if (heredoc) return heredoc.body.trim() ? 'heredoc' : 'empty-heredoc';
  const bare = unquoteAll(segment.text);
  if (/<<</.test(bare) || INPUT_REDIRECT.test(bare) || segment.after === '|') return 'present';
  return 'none';
}

export function pythonStdinCommand(command, { isStub = isStorePython, platform = process.platform } = {}) {
  const text = String(command || '');
  let cursor = 0;
  let skipTo = 0;
  for (const segment of segments(text)) {
    const start = text.indexOf(segment.text, cursor);
    cursor = start + segment.text.length;
    if (start < skipTo) continue;
    const heredoc = heredocAfter(text, start);
    const own = heredoc && heredoc.at < cursor ? heredoc : null;
    if (own) skipTo = own.end;
    const leader = pythonLeader(tokens(segment.text));
    if (!leader || !readsStdin(leader.args)) continue;
    const source = stdinSource(segment, own);
    if (platform === 'win32' && source === 'empty-heredoc') return { name: leader.name, reason: 'empty-heredoc' };
    if (platform === 'win32' && source === 'none') return { name: leader.name, reason: 'no-stdin' };
    if (isStub(leader.name.replace(/\.exe$/i, ''))) return { name: leader.name, reason: 'store-stub' };
  }
  return null;
}

/** True when a process command line is a python that reads its program from stdin (`python -`, bare `python`). */
export function isStdinPythonCommandLine(commandLine) {
  const leader = pythonLeader(tokens(String(commandLine || '')));
  return !!leader && readsStdin(leader.args);
}
