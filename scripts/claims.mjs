#!/usr/bin/env node
// claims.mjs — `claims --release <agent id> --reason "<why>"` (KIT-T1287). An agent killed by an API error (a usage limit) sends
// no stop event, so its file claims and write holds outlive it for the whole claim window and lock its files against its
// replacement and against the main thread's `git restore`. The MAIN THREAD releases a named agent's claims and holds with
// this verb; a subagent cannot: the gate refuses its command (hooks/claims-release-gate.mjs) and releaseDead, which the CLI
// and any import go through, refuses without the one-use main-thread stamp that gate exports (hooks/lib/claims-stamp.mjs,
// KIT-T1288). The agent must have written nothing for
// QUIET_MIN minutes: an agent still writing is alive. The release is recorded in the roster as a `killed` row naming the reason.
// An agent with no claims (it wrote nothing) whose roster row is still in flight gets that row ended the same way, after the
// same quiet check on its transcript (KIT-T1356): the dispatch gate otherwise reads it as a live writer.
//
//   releaseDead({ id, reason, root?, now?, quietMs? }) -> { ok, text }
//   node scripts/claims.mjs --release <agent id|prefix of 8+> --reason "<why>"      (bin/claims)
// A usage-limit kill sends no stop event, and a TaskStop's PostToolUse hook does not always fire (KIT-T1356), so orient's
// AGENT KILLED notice and the refusals that name a live writer name this verb.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlags } from './broker/cli.mjs';
import { isMain } from './is-main.mjs';
import { agentEntries, releaseAgent } from '../hooks/lib/checkout-holder.mjs';
import { endAgent, updateAgent } from '../hooks/lib/agent-roster.mjs';
import { lastActivityMs } from '../hooks/lib/subagent-transcript.mjs';
import { consumeStamp, STAMP_ENV } from '../hooks/lib/claims-stamp.mjs';

export const QUIET_MIN = 5;
const MS_PER_MINUTE = 60000;
const EXIT = { OK: 0, REFUSED: 2, USAGE: 64 };

function repoRoot(cwd) {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return cwd; }
}

export function releaseDead({ id, reason, root = repoRoot(process.cwd()), now = Date.now(), quietMs = QUIET_MIN * MS_PER_MINUTE, env = process.env }) {
  if (!id || !String(reason || '').trim()) return { ok: false, code: EXIT.USAGE, text: 'claims --release <agent id> --reason "<why>": both are required' };
  if (!consumeStamp(env[STAMP_ENV], id)) return { ok: false, code: EXIT.REFUSED, text: "claims --release: refused. It runs only from a main-thread call the kit stamped (hooks/claims-release-gate.mjs); a subagent raises it to the main thread, and a stamp is single-use and lasts 60 seconds" };
  const entries = agentEntries(id);
  const agents = [...new Set(entries.map((e) => e.agent))];
  if (!agents.length) return endRosterRow({ id, reason, root, now, quietMs });
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

function endRosterRow({ id, reason, root, now, quietMs }) {
  const nothing = `claims --release: no claim or hold is recorded for ${id}; nothing to release`;
  if (!existsSync(join(root, '.ai'))) return { ok: true, code: EXIT.OK, text: nothing };
  const last = lastActivityMs({ id });
  if (last !== null && now - last < quietMs) {
    return { ok: false, code: EXIT.REFUSED, text: `claims --release: agent ${id} wrote its transcript ${Math.round((now - last) / MS_PER_MINUTE)} min ago (ending its row needs ${QUIET_MIN} quiet minutes): it is alive, or it has not been dead long enough` };
  }
  const ended = endAgent(root, id, { status: 'killed', reason: 'released', summary: `roster row ended by the main thread: ${String(reason).trim()}`, source: 'claims-release' });
  return { ok: true, code: EXIT.OK, text: ended ? `${nothing}; its in-flight roster row is ended (killed)` : nothing };
}

if (isMain(import.meta.url)) {
  const flags = parseFlags(process.argv.slice(2));
  const result = typeof flags.release === 'string'
    ? releaseDead({ id: flags.release, reason: typeof flags.reason === 'string' ? flags.reason : '' })
    : { ok: false, code: EXIT.USAGE, text: 'usage: claims --release <agent id> --reason "<why>"   (main thread only)' };
  (result.ok ? console.log : console.error)(result.text);
  process.exit(result.code);
}
