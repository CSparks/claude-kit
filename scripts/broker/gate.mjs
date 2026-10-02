// gate.mjs — the gate phase (KIT-T276): every file a patch would leave behind goes through the
// kit's own pre-write hook as a synthesized Write payload, so a patch is held to the same
// checks (file length, comments, magic numbers, forbidden paths) as a hand edit. The hook is
// reused, never reimplemented; exit 2 is a block, its stderr names each failing check.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const HOOK = join(import.meta.dirname, '..', '..', 'hooks', 'pre-write.mjs');
const BLOCK = 2;
const FAILURE = /-- ([\s\S]*?)\s*\n\s*To exclude from this check \(id: ([\w-]+)\)/g;

/** Findings `{ path, check, msg }` for one file's content; empty when the hook allows it. */
export function gateFile(cwd, path, content) {
  const payload = { tool_name: 'Write', tool_input: { file_path: join(cwd, path), content } };
  const r = spawnSync(process.execPath, [HOOK], {
    cwd, input: JSON.stringify(payload), encoding: 'utf8', windowsHide: true, env: { ...process.env, CLAUDE_KIT_BROKER_GATE: '1' },
  });
  if (r.status !== BLOCK) return [];
  const found = [...r.stderr.matchAll(FAILURE)].map((m) => ({ path, check: m[2], msg: m[1].trim() }));
  return found.length ? found : [{ path, check: 'pre-write', msg: r.stderr.trim() }];
}

/** Gate every surviving file of a dry-run plan (a Map path → { text }). */
export function gatePlan(cwd, files) {
  const out = [];
  for (const [path, f] of files) if (f.text !== null) out.push(...gateFile(cwd, path, f.text));
  return out;
}
