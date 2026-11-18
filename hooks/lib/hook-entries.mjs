// hook-entries.mjs — the kit's hook entry points and whether a shell command runs one (KIT-T1357).
// A hook trusts its stdin as the harness's payload, so an agent that pipes a made-up payload into one (a TaskStop into
// agent-roster.mjs releases another agent's claims) acts with the harness's authority. Only the harness runs hooks.
//
//   SCRIPT_IN_COMMAND                      -> the hook script a hooks.json command launches through compat-run.mjs
//   hookEntryNames(hooksJsonPath?)         -> Set of file names: every script hooks.json launches, plus the launchers
//   runsHookEntry(command, toolName, names?) -> true when a segment runs one: node/bun/deno whose script (first non-flag
//        argument), `-e` code or `--import` module names an entry (a pipe into it too), an entry run as the command, or
//        a quoted body (`bash -c`, `eval`, `builds --run`) that does either. A test file (`agent-roster.test.mjs`), a node
//        script given an entry's path as an argument, a git or read command, and a lone print command pass.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { segments, shellOfTool, shellTokens, unquoteSpans } from './shell-segments.mjs';
import { printsOnly } from './claims-release-match.mjs';

export const SCRIPT_IN_COMMAND = /compat-run\.mjs"?\s+([a-z0-9-]+\.mjs)/;
const LAUNCHERS = ['compat-run.mjs', 'compat-core.mjs'];
const HOOKS_JSON = fileURLToPath(new URL('../hooks.json', import.meta.url));
const RUNTIMES = new Set(['node', 'bun', 'deno']);
const HOOKS_PATH = /(?:^|\/)hooks\/([a-z0-9-]+\.mjs)/g;
const QUOTE_MARKS = /["'`^]/g;
const COMMAND_EXTENSION = /\.(?:exe|cmd)$/i;
const CODE_FLAGS = new Set(['-e', '--eval', '-p', '--print']);
const MODULE_FLAGS = new Set(['-r', '--require', '--import', '--loader']);

export function hookEntryNames(hooksJsonPath = HOOKS_JSON) {
  const names = new Set(LAUNCHERS);
  let wiring = {};
  try { wiring = JSON.parse(readFileSync(hooksJsonPath, 'utf8')).hooks || {}; } catch { return names; }
  for (const groups of Object.values(wiring)) {
    for (const group of groups || []) {
      for (const hook of group.hooks || []) {
        const script = SCRIPT_IN_COMMAND.exec(hook.command || '')?.[1];
        if (script) names.add(script);
      }
    }
  }
  return names;
}

// Both readings of a backslash: a Windows path separator, and a shell escape that vanishes (`agent-r\oster.mjs`).
const readings = (token) => {
  const word = unquoteSpans(String(token || '')).replace(QUOTE_MARKS, '');
  return [word.replace(/\\/g, '/'), word.replace(/\\/g, '')];
};
const baseNames = (token) => readings(token).map((v) => (v.split('/').pop() || '').replace(COMMAND_EXTENSION, '').toLowerCase());
// An entry is a bare name (run from inside hooks/) or a path whose folder is hooks/: scripts/code-graph.mjs is a CLI that
// shares a hook's file name.
const named = (token, names) => readings(token).some((v) => {
  const parts = v.toLowerCase().split('/');
  return names.has(parts[parts.length - 1]) && (parts.length === 1 || parts[parts.length - 2] === 'hooks');
});
const codeNames = (token, names) => readings(token).some((v) => [...v.toLowerCase().matchAll(HOOKS_PATH)].some((m) => names.has(m[1])));

// The script a runtime word runs: its first non-flag argument, or the module or code a flag hands it.
function runtimeRuns(tokens, at, names) {
  for (let j = at + 1; j < tokens.length; j++) {
    const arg = unquoteSpans(tokens[j]);
    if (CODE_FLAGS.has(arg)) return codeNames(tokens[j + 1], names);
    if (MODULE_FLAGS.has(arg)) { if (named(tokens[j + 1], names)) return true; j++; continue; }
    if (!arg.startsWith('-')) return named(tokens[j], names);
  }
  return false;
}

function runs(tokens, names, toolName) {
  if (named(tokens[0], names)) return true;
  if (tokens.some((t) => /\s/.test(unquoteSpans(t)) && runsHookEntry(unquoteSpans(t), toolName, names))) return true;
  return tokens.some((t, i) => baseNames(t).some((b) => RUNTIMES.has(b)) && runtimeRuns(tokens, i, names));
}

export function runsHookEntry(command, toolName, names = hookEntryNames()) {
  const text = String(command || '');
  const segs = segments(text, { shell: shellOfTool(toolName) });
  if (segs.ambiguous) return runs(text.split(/\s+/), names, toolName);
  if (printsOnly(segs)) return false;
  return segs.some((s) => runs(shellTokens(s.text), names, toolName));
}
