// record.mjs — the plan-of-record gists in orientation (KIT-T071): SESSION.md, ROADMAP.md and the lineage line. Each
// shows its first lines inline and points at the file for the rest.
//
//   sessionSection(ctx, sessionFile)
//   roadmapSection(ctx, roadmapFile)
//   lineageSection(ctx)

import { existsSync } from 'node:fs';
import { readLineage, sessionStale } from '../../lib.mjs';
import { LINE_MAX, ROADMAP_GIST_LINES, SESSION_GIST_LINES, clip, head, lineCount } from './common.mjs';

const SESSION_LINE_MAX = LINE_MAX * 3;

export function sessionSection({ out, root }, session) {
  if (!existsSync(session)) return;
  out.push('');
  out.push('--- .ai/SESSION.md (resume here — first lines) ---');
  const ss = sessionStale(root);
  if (ss.stale) out.push(`!! SESSION.md is STALE (${ss.sessionDays}d, older than the last commit) — reconcile it to the work below before trusting it.`);
  out.push(head(session, SESSION_GIST_LINES).split('\n').map((l) => clip(l, SESSION_LINE_MAX)).join('\n'));
  const total = lineCount(session);
  if (total > SESSION_GIST_LINES) out.push(`  … (${total} lines total) — full: read .ai/SESSION.md`);
}

export function roadmapSection({ out }, roadmap) {
  if (!roadmap) return;
  out.push('');
  out.push('--- Plan-of-record (ROADMAP — current milestone) ---');
  out.push(head(roadmap, ROADMAP_GIST_LINES));
  const total = lineCount(roadmap);
  if (total > ROADMAP_GIST_LINES) out.push(`  … (${total} lines total) — full: head .ai/ROADMAP.md`);
}

export function lineageSection({ out, root }) {
  const lineage = readLineage(root);
  if (!lineage.length) return;
  const roles = [...new Set(lineage.map((l) => l.role).filter(Boolean))].sort().join(', ');
  out.push('');
  out.push(`--- Lineage (${lineage.length} relation(s)${roles ? ': ' + roles : ''}) — full: read .ai/lineage.yml ---`);
}
