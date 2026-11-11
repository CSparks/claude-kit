// build-origin.mjs — who started a build that holds cores (KIT-T1056), written into the hold so `builds` can name it.
//
//   startedBy(env?, script?) -> 'broker daemon (...)' | 'session <id8>' | 'a terminal or tool (no session id)'
//   CLAUDE_KIT_HOLD_BY=<text> overrides (tests). A broker daemon runs submitted jobs and its own post-land suite, so the
//   hold names the daemon and points at `broker status` for the job; the daemon's own environment never names an agent.

import { basename } from 'node:path';

const SESSION_ENVS = ['CLAUDE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID'];
const SESSION_CHARS = 8;
const BROKER_SCRIPT = /^broker/i;

export function startedBy(env = process.env, script = process.argv[1]) {
  if (env.CLAUDE_KIT_HOLD_BY) return env.CLAUDE_KIT_HOLD_BY;
  if (BROKER_SCRIPT.test(basename(String(script || '')))) return 'broker daemon (a submitted job or its own suite; see broker status)';
  const session = SESSION_ENVS.map((k) => env[k]).find(Boolean);
  return session ? `session ${String(session).slice(0, SESSION_CHARS)}` : 'a terminal or tool (no session id)';
}
