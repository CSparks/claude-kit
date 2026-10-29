// reap-state.mjs — the reaper's per-user state under `<claude home>/claude-kit-state` (never a shared temp
// name): the throttle stamp and the report a detached run leaves for the next SessionStart.
// `CLAUDE_KIT_REAP_STAMP_DIR` overrides the directory.
//
//   reapStampPath() / lastReapMs(path)  -> the stamp file and its reading (a future-dated stamp reads as 0)
//   writeReport(lines) / takeReport()   -> hand a detached run's lines to the next SessionStart, once

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR_MODE = 0o700;

function stateDir() {
  const dir = process.env.CLAUDE_KIT_REAP_STAMP_DIR || join(process.env.CLAUDE_HOME || join(homedir(), '.claude'), 'claude-kit-state');
  mkdirSync(dir, { recursive: true, mode: DIR_MODE });
  return dir;
}

export const reapStampPath = () => join(stateDir(), 'orphan-reaper.stamp');
const reportPath = () => join(stateDir(), 'orphan-reaper.report');

export function lastReapMs(path, now = Date.now()) {
  try {
    const at = Number(readFileSync(path, 'utf8')) || 0;
    return at > now ? 0 : at;
  } catch { return 0; }
}

export function writeReport(lines) {
  if (lines.length) writeFileSync(reportPath(), lines.join('\n') + '\n');
}

export function takeReport() {
  try {
    const text = readFileSync(reportPath(), 'utf8');
    rmSync(reportPath(), { force: true });
    return text.trimEnd().split('\n');
  } catch { return []; }
}
