// subagent-id.mjs — which subagent made this tool call, if any (KIT-D115).
// A PreToolUse payload from a subagent carries `agent_id`; its transcript is
// `<project>/<session>/subagents/agent-<id>.jsonl`. The main thread has neither.
//
//   subagentId(payload) -> the roster agent id, or '' for the main thread

import { basename } from 'node:path';

const SIDECHAIN = /^agent-(.+)\.jsonl$/i;
const first = (...vals) => vals.find((v) => typeof v === 'string' && v.trim())?.trim() || '';

export function subagentId(p) {
  const direct = first(p?.agent_id, p?.agentId);
  if (direct) return direct;
  const m = basename(String(p?.transcript_path ?? '').replace(/\\/g, '/')).match(SIDECHAIN);
  return m ? m[1] : '';
}
