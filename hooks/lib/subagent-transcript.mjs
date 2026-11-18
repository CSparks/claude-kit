// Where a delegated agent shows it is alive: the harness appends to
// `<claudeHome>/projects/<project>/<session>/subagents/agent-<id>.jsonl` on every turn, while the roster row's
// `outputFile` (the task's output stub) stays an empty file for an agent that runs in the foreground. Idleness read
// off the stub alone calls a busy worker dead.
//
//   transcriptPaths(row, { claudeHome? }) -> every written transcript of the agent: its subagent transcripts and a
//                                            non-empty outputFile; [] when nothing readable exists
//   lastActivityMs(row, opts)             -> the newest modification time among them, null when none
//   isLive(row, nowMs, opts)              -> true when one was written within LIVE_WINDOW_MS
//   stoppedByHarness(row, opts)           -> true when its freshest subagent transcript ends on the harness's interruption
//                                            turn (a TaskStop or an Esc); a SendMessage resume appends after it and clears it
//   lastEntry(path)                       -> the last non-empty line of a file, read from its tail

import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const LIVE_WINDOW_MS = 30 * 60 * 1000;
const TAIL_BYTES = 16 * 1024;
const INTERRUPTED = '[Request interrupted by user';

const claudeHomeDir = () => process.env.CLAUDE_HOME || join(homedir(), '.claude');

const dirsIn = (dir) => {
  try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(dir, e.name)); } catch { return []; }
};

function subagentFiles(id, claudeHome) {
  const found = [];
  for (const project of dirsIn(join(claudeHome, 'projects'))) {
    for (const session of dirsIn(project)) {
      const file = join(session, 'subagents', `agent-${id}.jsonl`);
      if (existsSync(file)) found.push(file);
    }
  }
  return found;
}

const writtenSize = (path) => { try { return statSync(path).size; } catch { return 0; } };

export function transcriptPaths(row, { claudeHome = claudeHomeDir() } = {}) {
  const paths = row && row.id ? subagentFiles(row.id, claudeHome) : [];
  if (row && row.outputFile && writtenSize(row.outputFile) > 0) paths.push(row.outputFile);
  return paths;
}

export function lastActivityMs(row, options) {
  const times = transcriptPaths(row, options).map((p) => { try { return statSync(p).mtimeMs; } catch { return 0; } });
  return times.length ? Math.max(...times) : null;
}

export function isLive(row, nowMs = Date.now(), options) {
  const last = lastActivityMs(row, options);
  return last !== null && nowMs - last <= LIVE_WINDOW_MS;
}

function tailLines(path) {
  const fd = openSync(path, 'r');
  try {
    const size = statSync(path).size;
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  } finally {
    closeSync(fd);
  }
}

export function lastEntry(path) {
  const lines = tailLines(path);
  return lines.length ? lines[lines.length - 1] : '';
}

const interruption = (entry) => {
  if (!entry || entry.type !== 'user' || !entry.message) return false;
  const { content } = entry.message;
  if (typeof content === 'string') return content.startsWith(INTERRUPTED);
  return Array.isArray(content) && content.some((b) => b && b.type === 'text' && String(b.text || '').startsWith(INTERRUPTED));
};

// The last entry carrying a message decides; a torn or oversized last line reads as not stopped (the row stays live).
export function stoppedByHarness(row, { claudeHome = claudeHomeDir() } = {}) {
  try {
    const files = row && row.id ? subagentFiles(row.id, claudeHome) : [];
    if (!files.length) return false;
    const freshest = files.reduce((a, b) => (statSync(b).mtimeMs > statSync(a).mtimeMs ? b : a));
    for (const line of tailLines(freshest).reverse()) {
      let entry;
      try { entry = JSON.parse(line); } catch { return false; }
      if (entry && entry.message) return interruption(entry);
    }
    return false;
  } catch {
    return false;
  }
}
