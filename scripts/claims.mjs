#!/usr/bin/env node
// claims.mjs — `claims --release <agent id> --reason "<why>"` (KIT-T1287). An agent killed by an API error (a usage limit) sends
// no stop event, so its file claims and write holds outlive it for the whole claim window and lock its files against its
// replacement and against the main thread's `git restore`. The MAIN THREAD releases a named agent's claims and holds with
// this verb; a subagent cannot (hooks/claims-release-gate.mjs refuses it). The agent must have written nothing for
// QUIET_MIN minutes: an agent still writing is alive. The release is recorded in the roster as a `killed` row naming the reason.
//
//   releaseDead({ id, reason, root?, now?, quietMs? }) -> { ok, text }
//   node scripts/claims.mjs --release <agent id|prefix of 8+> --reason "<why>"      (bin/claims)
// A killed agent's harness stop event: none reaches a hook (SubagentStop fires only on a normal end), so nothing releases it
// automatically; orient's AGENT KILLED notice and the refusals that name a live writer name this verb.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlags } from './broker/cli.mjs';
import { agentEntries, releaseAgent } from '../hooks/lib/checkout-holder.mjs';
import { updateAgent } from '../hooks/lib/agent-roster.mjs';

export const QUIET_MIN = 5;
const MS_PER_MINUTE = 60000;
const EXIT = { OK: 0, REFUSED: 2, USAGE: 64 };

function repoRoot(cwd) {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return cwd; }
}

export function releaseDead({ id, reason, root = repoRoot(process.cwd()), now = Date.now(), quietMs = QUIET_MIN * MS_PER_MINUTE }) {
  if (!id || !String(reason || '').trim()) return { ok: false, code: EXIT.USAGE, text: 'claims --release <agent id> --reason "<why>": both are required' };
  const entries = agentEntries(id);
  const agents = [...new Set(entries.map((e) => e.agent))];
  if (!agents.length) return { ok: true, code: EXIT.OK, text: `claims --release: no claim or hold is recorded for ${id}; nothing to release` };
  if (agents.length > 1) return { ok: false, code: EXIT.REFUSED, text: `claims --release: ${id} names ${agents.length} agents (${agents.join(', ')}); give the full id` };
  const [agent] = agents;
  const latest = Math.max(...entries.map((e) => e.beatAt));
  if (now - latest < quietMs) {
    return { ok: false, code: EXIT.REFUSED, text: `claims --release: agent ${agent} wrote ${Math.round((now - latest) / MS_PER_MINUTE)} min ago (a release needs ${QUIET_MIN} quiet minutes): it is alive, or it has not been dead long enough` };
  }
  releaseAgent(agent);
  if (existsSync(join(root, '.ai'))) updateAgent(root, agent, { status: 'killed', summary: `claims released by the main thread: ${String(reason).trim()}` });
  return { ok: true, code: EXIT.OK, text: `claims --release: released ${entries.length} claim(s) and hold(s) of agent ${agent} (last write ${Math.round((now - latest) / MS_PER_MINUTE)} min ago); recorded in the roster` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = parseFlags(process.argv.slice(2));
  const result = typeof flags.release === 'string'
    ? releaseDead({ id: flags.release, reason: typeof flags.reason === 'string' ? flags.reason : '' })
    : { ok: false, code: EXIT.USAGE, text: 'usage: claims --release <agent id> --reason "<why>"   (main thread only)' };
  (result.ok ? console.log : console.error)(result.text);
  process.exit(result.code);
}
