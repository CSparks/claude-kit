// Per-project search log (KIT-T285): one JSON line per search-shaped tool call or gate block.
// Machine-local under ~/.claude/search-log/<project-key>.jsonl (CLAUDE_KIT_SEARCH_LOG_DIR
// overrides, for tests). Fail-open everywhere — telemetry never costs a tool call.
//
//   logSearch(root, row)          append { ts, ...row }
//   readSearchLog(root, days)     rows from the last `days` days (oldest first)

import { appendFileSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const MS_PER_DAY = 86400000;

function keyOf(root) {
  let r = String(root);
  try { r = realpathSync.native(r); } catch { /* keep the given spelling */ }
  if (process.platform === 'win32') r = r.toLowerCase();
  return r.replace(/[:\\/ ]/g, '-').replace(/^-+/, '') || 'root';
}

export const searchLogPath = (root) =>
  join(process.env.CLAUDE_KIT_SEARCH_LOG_DIR || join(homedir(), '.claude', 'search-log'), `${keyOf(root)}.jsonl`);

export function logSearch(root, row) {
  try {
    const p = searchLogPath(root);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n');
  } catch {
    /* telemetry is best-effort */
  }
}

export function readSearchLog(root, days) {
  let text = '';
  try { text = readFileSync(searchLogPath(root), 'utf8'); } catch { return []; }
  const since = Date.now() - days * MS_PER_DAY;
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      const r = JSON.parse(line);
      if (Date.parse(r.ts) >= since) rows.push(r);
    } catch { /* skip a torn line */ }
  }
  return rows;
}
