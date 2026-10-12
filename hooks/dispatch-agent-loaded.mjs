// Agent-registry staleness (KIT-T431). A session loads the plugin's agent types once, at start. A
// kit agent added after that moment is in the manifest and the cache yet "not found" to the Agent
// tool for the rest of the session. This check predicts the miss before the dispatch fails.
//
//   unloadedAgentWarning({ root, input, transcriptPath, kitRoot }) -> warning text | null
//
// Warn-only: `/reload-plugins` refreshes the registry mid-session, which the hook cannot see.
// Fires for `<plugin>:<agent>` types whose agents/<agent>.md was added to the kit after the
// session's first transcript timestamp.

import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './lib/exec.mjs';

export const AGENT_LOADED_CHECK = 'agent-registry-stale';
const HEAD_BYTES = 64 * 1024;
const TIMESTAMP = /"timestamp":"([^"]+)"/;

export function sessionStartMs(transcriptPath) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return null;
    const fd = openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = readSync(fd, buf, 0, HEAD_BYTES, 0);
    closeSync(fd);
    const stamp = buf.toString('utf8', 0, n).match(TIMESTAMP);
    const parsed = stamp ? Date.parse(stamp[1]) : NaN;
    return Number.isFinite(parsed) ? parsed : statSync(transcriptPath).birthtimeMs;
  } catch {
    return null;
  }
}

function agentAddedMs(kitRoot, agent) {
  const rel = `agents/${agent}.md`;
  if (!existsSync(join(kitRoot, rel))) return null;
  const log = git(['log', '--diff-filter=A', '--format=%ct', '--', rel], kitRoot);
  const first = String(log || '').trim().split('\n').filter(Boolean).pop();
  return first ? Number(first) * 1000 : null;
}

export function unloadedAgentWarning({ input, transcriptPath, kitRoot }) {
  const type = String(input.subagent_type || input.agent_type || '');
  const m = type.match(/^([\w-]+):([\w-]+)$/);
  if (!m) return null;
  const started = sessionStartMs(transcriptPath);
  const added = agentAddedMs(kitRoot, m[2]);
  if (started === null || added === null || added <= started) return null;
  return [
    `WARNING: agent type "${type}" was added to the kit (${new Date(added).toISOString().slice(0, 10)}) after this session started (${new Date(started).toISOString().slice(0, 10)}) (KIT-T431).`,
    'A session loads plugin agents once at start, so the Agent tool will likely answer "not found".',
    `Fix: run /reload-plugins, or restart the session. Until then dispatch general-purpose with agents/${m[2]}.md as the brief.`,
  ].join('\n');
}
