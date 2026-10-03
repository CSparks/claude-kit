// gate.mjs — the gate phase (KIT-T276): every file a patch would leave behind goes through the
// kit's own pre-write hook as a synthesized Write payload, so a patch is held to the same
// checks (file length, comments, magic numbers, forbidden paths) as a hand edit. The hook is
// reused, never reimplemented; exit 2 is a block, its stderr names each failing check.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// BROKER_GATE_HOOK swaps the hook script; tests drive a crashing hook through it.
const HOOK = join(import.meta.dirname, '..', '..', 'hooks', 'pre-write.mjs');
const BLOCK = 2;
export const GATE_CRASH = 'gate-crash';
const FAILURE = /-- ([\s\S]*?)\s*\n\s*To exclude from this check \(id: ([\w-]+)\)/g;

/** Findings `{ path, check, msg }` for one file's content; empty when the hook allows it. A hook that crashes yields a `gate-crash` finding. */
export function gateFile(cwd, path, content) {
  const payload = { tool_name: 'Write', tool_input: { file_path: join(cwd, path), content } };
  const r = spawnSync(process.execPath, [process.env.BROKER_GATE_HOOK || HOOK], {
    cwd, input: JSON.stringify(payload), encoding: 'utf8', windowsHide: true, env: { ...process.env, CLAUDE_KIT_BROKER_GATE: '1' },
  });
  if (r.status === 0) return [];
  if (r.status !== BLOCK) return [{ path, check: GATE_CRASH, msg: `pre-write hook exited ${r.status}: ${(r.error ? String(r.error) : r.stderr || '').trim().slice(0, 300)}` }];
  const found = [...r.stderr.matchAll(FAILURE)].map((m) => ({ path, check: m[2], msg: m[1].trim() }));
  return found.length ? found : [{ path, check: 'pre-write', msg: r.stderr.trim() }];
}

/** Gate every surviving file of a dry-run plan (a Map path → { text }). */
export function gatePlan(cwd, files) {
  const out = [];
  for (const [path, f] of files) if (f.text !== null) out.push(...gateFile(cwd, path, f.text));
  return out;
}
