// block-once.mjs — a Stop hook that blocks on a finding blocks ONCE per distinct finding (KIT-T530).
// `firstSighting(scope, finding)` → true when `finding` differs from the last one recorded for `scope`
// (and records it), false when it repeats; `clearSighting(scope)` forgets it once the check passes.
// State is one small file in the OS temp dir per scope; any I/O error reads as "first sighting".

import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const digest = (text) => createHash('sha1').update(String(text)).digest('hex');
const file = (scope) => join(tmpdir(), `claude-kit-block-${digest(scope).slice(0, 16)}.json`);

export function firstSighting(scope, finding) {
  const sig = digest(finding);
  try { if (JSON.parse(readFileSync(file(scope), 'utf8')).sig === sig) return false; } catch { /* no record */ }
  try { writeFileSync(file(scope), JSON.stringify({ sig })); } catch { /* best effort */ }
  return true;
}

export function clearSighting(scope) {
  try { rmSync(file(scope), { force: true }); } catch { /* best effort */ }
}
