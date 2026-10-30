// `t edit <id> --section Description|Plan|Notes --file <path>` — replace one `## Section` of an item with the
// text of a file (KIT-T725, KIT-D120). Every other section and the frontmatter stay byte for byte; a History
// `(edit)` line records the change. The write is a single file write, so a failed read or a missing section
// leaves the item untouched.
//
//   editSection(root, id, section, text) -> { id, section, path }

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileForId } from './id-utils.mjs';
import { splitFrontmatter } from './frontmatter.mjs';
import { appendUnderSection, replaceSection, stamp } from './md-body.mjs';

export const EDITABLE_SECTIONS = ['Description', 'Plan', 'Notes'];

export function editSection(root, id, section, text) {
  const heading = EDITABLE_SECTIONS.find((s) => s.toLowerCase() === String(section || '').toLowerCase());
  if (!heading) throw new Error(`t edit: --section is one of ${EDITABLE_SECTIONS.join(' | ')} (got '${section ?? ''}')`);
  if (!String(text ?? '').trim()) throw new Error('t edit: the --file draft is empty — nothing to replace the section with');
  const aiDir = join(root, '.ai');
  const rel = fileForId(aiDir, id);
  if (!rel) throw new Error(`t edit: unknown id '${id}' — no item in ${aiDir} carries it`);
  const path = join(aiDir, rel);
  const parts = splitFrontmatter(readFileSync(path, 'utf8'));
  if (!parts) throw new Error(`t edit: ${id} has no frontmatter block`);
  const replaced = replaceSection(parts.rest, heading, text);
  if (replaced === null) throw new Error(`t edit: ${id} has no ## ${heading} section to replace`);
  const body = appendUnderSection(replaced, 'History', `- [${stamp()}] (edit) ${heading} replaced`);
  writeFileSync(path, parts.open + parts.fm + parts.close + body);
  return { id, section: heading, path };
}
