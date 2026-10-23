// receipt.mjs — the sweep's printed receipt and the one-line-per-run log the SessionStart nag reads (KIT-T636).
//
//   sweepHome()          -> directory holding build-sweep.log (default ~/.claude)
//   appendReceipt(r)     -> writes r as one JSON line (best-effort)
//   lastReceipt()        -> the newest logged receipt, or null
//   formatReceipt(r, top)-> printable lines
//   describeReceipt(r)   -> one human line (used by the hook)

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const GIB = 1024 ** 3;
const TOP_REPOS = 8;

export const sweepHome = () => process.env.CLAUDE_KIT_SWEEP_HOME || join(homedir(), '.claude');
export const logPath = () => join(sweepHome(), 'build-sweep.log');

export const gb = (bytes) => (bytes / GIB).toFixed(2);

export function appendReceipt(receipt) {
  try {
    mkdirSync(sweepHome(), { recursive: true });
    appendFileSync(logPath(), `${JSON.stringify(receipt)}\n`);
  } catch {
    /* the log is best-effort */
  }
}

export function lastReceipt() {
  try {
    if (!existsSync(logPath())) return null;
    const lines = readFileSync(logPath(), 'utf8').split('\n').filter(Boolean);
    return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
  } catch {
    return null;
  }
}

export function describeReceipt(r) {
  const skipped = r.skipped.length ? `; skipped ${r.skipped.length} repo(s)` : '';
  return `${r.at.slice(0, 10)}: scanned ${r.buildDirs} build dir(s), removed ${r.removed} item(s), freed ${gb(r.bytes)} GB${skipped}`;
}

export function formatReceipt(r, top = TOP_REPOS) {
  const lines = [
    `build-sweep ${r.dryRun ? '(dry run) ' : ''}${r.root}: scanned ${r.buildDirs} build dir(s) / ${r.profiles} profile dir(s)`,
    `  ${r.dryRun ? 'would remove' : 'removed'} ${r.removed} item(s) (${r.wholeDirs} whole idle dir(s)), ${r.dryRun ? 'would free' : 'freed'} ${gb(r.bytes)} GB${r.failed ? `, ${r.failed} failed` : ''}`,
  ];
  const repos = Object.entries(r.repos).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, top);
  for (const [name, s] of repos) lines.push(`  ${name}: ${s.removed} item(s), ${gb(s.bytes)} GB`);
  if (r.unverified) lines.push(`  ${r.unverified} build dir(s) left alone: no cargo signature plus .fingerprint`);
  for (const s of r.skipped) lines.push(`  skipped ${s.repo}: ${s.reason}`);
  return lines;
}
