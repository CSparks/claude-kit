// question-store.mjs — read a project's `.ai/questions/` files as { id, file, text } records
// (KIT-T448); the hooks and CLIs that judge the lifecycle share this one directory walk.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitFrontmatter, field } from './frontmatter.mjs';

/** Every question file under `<root>/.ai/questions/`; [] when the directory is absent. */
export function readQuestions(root) {
  const dir = join(root, '.ai', 'questions');
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const file = join(dir, name);
    try {
      const text = readFileSync(file, 'utf8');
      const id = field(splitFrontmatter(text)?.fm || '', 'id') || name.replace(/\.md$/, '');
      out.push({ id, file, text });
    } catch { /* unreadable file — skip */ }
  }
  return out;
}
