// land-anchor.mjs — a landing writes its own resume-anchor line (KIT-T1051). The daemon lands and auto-pins between
// the orchestrator's turns, so the broker appends `broker landed <sha> <ticket> <title>` to `.ai/SESSION.md` through
// the `t session` writer (t-session.mjs); the orchestrator still adds state and next steps by hand.
//
//   anchorLine(result) -> the text of the line, or null when the result carries no landed sha (the caller checks status)
//   noteLanding(cfg, result) -> true when a line was written; best effort, never throws; a checkout without an
//                               `.ai/` store, and a sha the anchor already names, are left alone

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeSession } from '../t-session.mjs';

const SHA_CHARS = 10;

export function anchorLine(result) {
  if (!result || !result.landed || !result.landed.sha) return null;
  const sha = String(result.landed.sha).slice(0, SHA_CHARS);
  const title = String(result.title || '').replace(/\s+/g, ' ').trim();
  return `broker landed ${sha} ${result.ticket || '-'} ${title}`.trimEnd();
}

export function noteLanding(cfg, result) {
  try {
    const line = anchorLine(result);
    const store = join(cfg.root, '.ai');
    if (!line || !existsSync(store)) return false;
    const file = join(store, 'SESSION.md');
    const sha = line.split(' ')[2];
    if (existsSync(file) && readFileSync(file, 'utf8').split('\n').some((l) => l.includes(`broker landed ${sha} `) || l.endsWith(`broker landed ${sha}`))) return false;
    writeSession(cfg.root, line);
    return true;
  } catch { return false; }
}
