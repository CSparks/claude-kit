// handoff-close.mjs — close an ended worker's handoff as "nothing owed" (KIT-T830). The reconciler keeps naming a
// successor for a worker that stopped by design (a measure job that found no problem); this records the decision where it
// lasts: a comment on each ticket, `no successor owed [agent <id>]: <reason>`, which handoffClosed (hooks/lib/successor.mjs)
// reads on every reconcile.
//
//   closeHandoffs(root, agentId, reason, { tickets?, run? }) -> the ticket ids closed; throws on an empty reason.
//     tickets: close only these; default every ticket the reconciler still names for that agent (successor or dead).

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAgents } from '../../hooks/lib/agent-roster.mjs';
import { reconcileHandbacks } from '../../hooks/lib/handback.mjs';
import { NO_SUCCESSOR_MARKER } from '../../hooks/lib/successor.mjs';
import { sameAgent } from './finished-ack.mjs';

const T_CLI = fileURLToPath(new URL('../t.mjs', import.meta.url));
const OPEN_KINDS = new Set(['successor', 'dead']);
const AUTHOR = 'orchestrator';
const ID_PREFIX_CHARS = 8;

const commentOn = (root, ticket, text) => execFileSync(process.execPath, [T_CLI, 'comment', ticket, text, '--author', AUTHOR, '--root', root], { cwd: root, stdio: 'ignore' });

export function closeHandoffs(root, agentId, reason, { tickets, run = commentOn } = {}) {
  if (!String(reason || '').trim()) throw new Error('a reason is required: --reason "<why nothing is owed>"');
  const named = tickets?.length ? tickets : [...new Set(reconcileHandbacks(root, readAgents(root), { autoAck: false })
    .filter((i) => OPEN_KINDS.has(i.kind) && sameAgent(i.agent, agentId)).map((i) => i.ticket))];
  const text = `${NO_SUCCESSOR_MARKER} [agent ${String(agentId).slice(0, ID_PREFIX_CHARS)}]: ${String(reason).trim()}`;
  for (const ticket of named) run(root, ticket, text);
  return named;
}
