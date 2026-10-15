// `t notes <id> "<prose>"` — append prose to an item's `## Notes` section (KIT-T509). Works on any
// item file in the project store (ticket, epic, request, note, question, decision); a missing section is
// created before ## History, else at the end of the body. The prose lands verbatim: Notes stay free-form
// narrative (KIT-D037), this verb only owns the write.
//
//   appendNotes(root, id, text) -> { id, path }

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileForId } from './id-utils.mjs';
import { splitFrontmatter } from './frontmatter.mjs';
import { appendUnderSection } from './md-body.mjs';

export function appendNotes(root, id, text) {
  if (!String(text ?? '').trim()) throw new Error('t notes: non-empty "<prose>" (or --file <path>) is required');
  const aiDir = join(root, '.ai');
  const rel = fileForId(aiDir, id);
  if (!rel) throw new Error(`t notes: unknown id '${id}' — no item in ${aiDir} carries it`);
  const path = join(aiDir, rel);
  const raw = readFileSync(path, 'utf8');
  const parts = splitFrontmatter(raw);
  if (!parts) throw new Error(`t notes: ${id} has no frontmatter block`);
  const prose = String(text).trimEnd();
  const hasNotes = /^## Notess*$/m.test(parts.rest);
  const history = parts.rest.search(/^## Historys*$/m);
  const body = !hasNotes && history >= 0
    ? `${parts.rest.slice(0, history)}## Notes
${prose}

${parts.rest.slice(history)}`
    : appendUnderSection(parts.rest, 'Notes', prose);
  writeFileSync(path, parts.open + parts.fm + parts.close + body);
  return { id, path };
}
