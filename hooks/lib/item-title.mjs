// item-title.mjs — the plain-words title of a store item (ticket, request, epic, decision, question, note) by id.
//   itemTitle(root, id, table?) -> the frontmatter title; else a question's `**Q:**` line; else the file-name slug; null when no store holds the id.
// Looks in `root`, then in the registered project whose id key prefixes the id.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { projectTable } from '../../scripts/cap-routing.mjs';
import { field, frontmatterBlock } from '../../scripts/frontmatter.mjs';

const STORE_DIRS = [['tickets'], ['tickets', 'archive'], ['requests'], ['epics'], ['decisions'], ['questions'], ['notes']];
const KEY_OF_ID = /^([A-Z0-9]+)-[A-Z]\d+$/;
const QUESTION_LINE = /\*\*Q:\*\*\s*([^\n]+)/;

function titleIn(repo, id) {
  for (const parts of STORE_DIRS) {
    const dir = join(repo, '.ai', ...parts);
    if (!existsSync(dir)) continue;
    const file = readdirSync(dir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md'));
    if (!file) continue;
    const text = readFileSync(join(dir, file), 'utf8');
    return field(frontmatterBlock(text), 'title') || QUESTION_LINE.exec(text)?.[1] || file.slice(id.length + 1, -'.md'.length).replace(/-/g, ' ');
  }
  return null;
}

export function itemTitle(root, id, table) {
  const here = titleIn(root, id);
  if (here) return here;
  const key = KEY_OF_ID.exec(id)?.[1];
  const project = key && (table || projectTable()).find((p) => p.key && p.key.toUpperCase() === key);
  return project ? titleIn(dirname(project.aiDir), id) : null;
}
