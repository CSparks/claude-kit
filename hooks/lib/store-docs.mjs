// store-docs — the decisions and open tickets of a project's `.ai` store, read as searchable documents (KIT-T936).
//
//   storeDocs(root) -> [{ id, kind: 'decision' | 'ticket', title, text }]
//     decisions: every `.ai/decisions/<ID>-*.md`; tickets: every `.ai/tickets/<ID>-*.md` whose status is not closed.
//     text is the whole file. A missing directory is an empty list; an unreadable one throws (the caller fails open).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock } from '../../scripts/frontmatter.mjs';
import { ID_CITE_SRC } from './ids.mjs';

const FILE_ID = new RegExp(`^(${ID_CITE_SRC})-`);
const CLOSED = new Set(['done', 'lapsed', 'superseded', 'wontfix']);

function readDir(root, dir, kind) {
  const path = join(root, '.ai', dir);
  if (!existsSync(path)) return [];
  const docs = [];
  for (const file of readdirSync(path)) {
    const id = FILE_ID.exec(file)?.[1];
    if (!id || !file.endsWith('.md')) continue;
    const text = readFileSync(join(path, file), 'utf8');
    const meta = frontmatterBlock(text);
    if (CLOSED.has(String(field(meta, 'status') || '').toLowerCase())) continue;
    docs.push({ id, kind, title: field(meta, 'title') || file.slice(id.length + 1, -'.md'.length).replace(/-/g, ' '), text });
  }
  return docs;
}

export const storeDocs = (root) => [...readDir(root, 'decisions', 'decision'), ...readDir(root, 'tickets', 'ticket')];
