// Hook input: each hook reads its tool payload from stdin once per invocation.
// `payload()` is the normal entry point; it never throws (a missing/malformed
// payload yields {} so a hook fails open).

import { setShellCwd } from './paths.mjs';
import { commandCwd } from './shell-cwd.mjs';

const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

export async function readStdin() {
  const chunks = [];
  try {
    for await (const c of process.stdin) chunks.push(c);
  } catch {
    /* no stdin (e.g. SessionStart) */
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function payload() {
  try {
    const p = JSON.parse(await readStdin());
    if (SHELL_TOOLS.has(p.tool_name) && typeof p.tool_input?.command === 'string') setShellCwd(commandCwd(p.tool_input.command));
    return p;
  } catch {
    return {};
  }
}
