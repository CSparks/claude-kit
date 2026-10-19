// broker-hand-edit.mjs — the warning a hand edit gets when it lands in a build input of a lane
// whose broker daemon is live (KIT-T568). Such an edit is allowed, but it pauses that lane's queue
// until the tree is clean again, so the editor hears it once per session and lane, with the
// numbers: which daemon, how many jobs wait, how to step aside.
//
//   handEditWarning(file, sessionId) -> warning text the first time this session edits a lane's build input, else null
//   Fails open: any error is "no warning".

import { dirname, join, relative } from 'node:path';
import { liveLaneOfFile } from '../dispatch-broker.mjs';
import { git } from '../lib.mjs';
import { brokerPaths, readBrokerConfig, withLane } from '../../scripts/broker/config.mjs';
import { listQueue } from '../../scripts/broker/result.mjs';
import { readTurnState, writeTurnState } from './turn-state.mjs';

const WARNED_SLOT = 'broker-hand-edit';

// The checkout whose .ai/config.yml declares the broker: the superproject when `file` sits in a submodule.
function brokerRoot(file) {
  const repo = git(['rev-parse', '--show-toplevel'], dirname(file)).trim();
  if (!repo) return null;
  return git(['rev-parse', '--show-superproject-working-tree'], repo).trim() || repo;
}

export function handEditWarning(file, sessionId = '') {
  try {
    const root = brokerRoot(file);
    if (!root) return null;
    const live = liveLaneOfFile(root, relative(root, file));
    if (!live) return null;
    const laneName = live.lane || 'root';
    const warned = readTurnState(root, WARNED_SLOT) || {};
    const key = `${sessionId || 'unknown'}:${laneName}`;
    if (warned[key]) return null;
    writeTurnState(root, { ...warned, [key]: Date.now() }, WARNED_SLOT);
    const cfg = withLane(readBrokerConfig(root), live.lane);
    return [
      `broker: WARNING: a broker daemon (pid ${live.held.pid}, ${laneName} lane, ${live.home}) is live, and this edit to a build input pauses its queue.`,
      `  ${listQueue(cfg).length} job(s) wait in that queue; none runs until the tree is committed, reverted or stashed.`,
      `  Prefer a patch through the broker (claude-kit:patch-worker). To hand-edit anyway, tell the orchestrator and run: node ${join(import.meta.dirname, '..', '..', 'scripts', 'broker', 'broker.mjs')} pause --root ${root} (resume when done)`,
      `  \`broker.mjs status\` and wait name this session as the holder; orient raises it after 5 min.`,
      '',
    ].join('\n');
  } catch {
    return null;
  }
}
