#!/usr/bin/env node
// PreToolUse (Write|Edit) — the write-time guard of a shared checkout (KIT-T811, KIT-D155, KIT-T1114). The kit never limits
// how many writers share a checkout; it refuses exactly three collisions, every one per file or per build:
//   - another live SESSION has uncommitted changes to this file (lib/session-overlap.mjs, the session write ledger);
//   - another live agent of this session has uncommitted changes to this file (lib/agent-claims.mjs, per-writer claims);
//   - another writer's cargo build is compiling the crate this file belongs to (lib/build-write-hold.mjs).
// A passing edit beats the session's checkout-holder entry and records the writer's claim on the file. Store (.ai/) files
// never count. Fails open on any error.

import { payload, gitRoot, gitRootOfFile, isStorePath, pathExcluded, excludeFooter, git } from './lib.mjs';
import { beatHolder, claimFile, refuseEdit } from './lib/checkout-holder.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { overlapLines } from './lib/session-overlap.mjs';
import { overlappingHolders } from './lib/live-claims.mjs';
import { claimConflicts, claimMessage } from './lib/agent-claims.mjs';
import { buildHoldConflict, buildHoldMessage } from './lib/build-write-hold.mjs';
import { writerId } from './lib/tool-writes.mjs';
import { repoRelative } from './turn-writes.mjs';
import { HOLDER_CHECK } from './dispatch-holder.mjs';

const sessionMessage = (file, found, tree) => [
  `BLOCKED: another live session has uncommitted changes to ${file} (KIT-D155).`,
  `  tree: ${tree}`,
  ...overlapLines(found),
  '',
  'Two sessions writing one file lose work. Wait until that session commits it, or send it the change.',
  'Sessions on other files raise no flag here.',
  excludeFooter(HOLDER_CHECK),
].join('\n');

// The refusal for this write, as { text, session }: `session` marks a refusal the session ledger must disown.
function refusal({ tree, file, rel, session, agent }) {
  const sessions = overlappingHolders({ tree, session, paths: [rel] });
  if (sessions.length) return { text: sessionMessage(rel, sessions, tree), session: true };
  const claimants = claimConflicts({ tree, session, agent, rel });
  if (claimants.length) return { text: claimMessage({ rel, tree, claimants, footer: excludeFooter(HOLDER_CHECK) }) };
  const hold = buildHoldConflict({ file, writer: writerId(session, agent) });
  return hold ? { text: buildHoldMessage({ file: rel, hold, footer: excludeFooter(HOLDER_CHECK) }) } : null;
}

try {
  const p = await payload();
  const file = (p.tool_input && (p.tool_input.file_path || p.tool_input.path)) || '';
  const tree = file && !isStorePath(file) ? gitRootOfFile(file) : '';
  const agent = subagentId(p);
  if (tree && p.session_id) {
    const rel = repoRelative(tree, file);
    const refused = rel && !pathExcluded(tree, HOLDER_CHECK, file) ? refusal({ tree, file, rel, session: p.session_id, agent }) : null;
    if (refused) {
      if (refused.session) refuseEdit({ tree, session: p.session_id, path: rel });
      process.stderr.write(refused.text);
      process.exit(2);
    }
    const label = agent ? String(p.agent_type || 'subagent') : 'main thread';
    beatHolder({ tree, session: p.session_id, agent, origin: gitRoot(), edited: rel, label });
    claimFile({ tree, session: p.session_id, agent, label, rel, head: git(['rev-parse', 'HEAD'], tree).trim() });
  }
} catch {
  /* a guard never wedges an edit */
}
process.exit(0);
