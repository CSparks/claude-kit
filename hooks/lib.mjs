// Public boundary for the claude-kit Node hook helpers. Portable across machines — no
// bash/python, no OS-shell path quirks (the bug that silently disabled the earlier bash
// hooks). Each hook reads the tool payload from stdin, decides, and exits: code 2 = block,
// 0 = allow.
//
// The implementations live in ./lib/<concern>.mjs, one concern per file; this is the single
// deliberate barrel every hook imports. Import a concern module directly when only one is
// needed.

export { readStdin, payload } from './lib/stdin.mjs';
export { git, gitTry, have, run, runStatus, nodeCli } from './lib/exec.mjs';
export { compileSignals, loadCaptureConfig, watchRepos, readLineage, uatDefault } from './lib/config.mjs';
export {
  gitRoot, adopted, projectName, centralDataRoot, storeRoot, projectRoot,
  VENDORED, LOCKFILES, fileExt,
} from './lib/paths.mjs';
export { ID_CITE_SRC } from './lib/ids.mjs';
export { registryPath, REGISTRY, readRegistry, projectAiDirs, recordProject } from './lib/registry.mjs';
export { writeItemFile } from './lib/store-write.mjs';
export {
  wipSummary, remoteWebUrl, remoteCommitUrl, aheadBehind, formatWip, WIP_FILES, WIP_COMMITS,
} from './lib/git-state.mjs';
export { loadIgnoreConfig, globToRegExp, pathExcluded, markerExcludedLines, excludeFooter } from './lib/exclusions.mjs';
export { MAINT_LOG, logGap } from './lib/maintenance-log.mjs';
export { scanInbox, scanReviewQueue, scanStaleDoingTickets } from './lib/closure-scans.mjs';
export { scanReminders } from './lib/reminders.mjs';
export { readTurnState, writeTurnState } from './lib/turn-state.mjs';
export { sessionStale, sessionMtimeMs } from './lib/session.mjs';
export {
  AGENT_ROSTER_REL, AGENT_STALE_MS, AGENT_ROSTER_TAIL,
  agentsPath, recordAgent, updateAgent, readAgents, partitionAgents,
} from './lib/agent-roster.mjs';
