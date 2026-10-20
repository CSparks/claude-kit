// Agents whose Write tool is confined to scratch space. A patch worker authors its envelope files
// with Write and submits them to the broker; it never writes the working tree (the daemon does).
// pre-write asks this before anything else: a Write outside the system temp dir (where the session
// scratchpad lives) by such an agent is refused and the message names where to write instead.
//
//   scratchOnlyViolation(agentType, file) -> null | { agent, tmp }

import { tmpdir } from 'node:os';
import { relative, resolve, isAbsolute, sep } from 'node:path';

const SCRATCH_ONLY = /(?:^|:)patch-worker$/i;

export const isScratchOnlyAgent = (agentType) => SCRATCH_ONLY.test(String(agentType || '').trim());

function underTmp(file) {
  const rel = relative(resolve(tmpdir()), resolve(file));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.startsWith(sep);
}

export function scratchOnlyViolation(agentType, file) {
  if (!isScratchOnlyAgent(agentType)) return null;
  if (underTmp(file)) return null;
  return { agent: String(agentType), tmp: tmpdir() };
}
